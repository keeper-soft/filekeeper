using System.Security.Cryptography;
using CmsLite.Database;
using CmsLite.Database.Repositories;
using CmsLite.Helpers;
using CmsLite.Helpers.RequestMappers;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Routing;

namespace CmsLite.Content;

public static class ContentEndpoints
{

    public static void MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        var contentGroup = app.MapGroup("/v1").WithTags("Content Management");

        // PUT /v1/{tenant}/{resource} - Create or update content
        contentGroup.MapPut("/{tenant}/{resource}", async (
            string tenant,
            string resource,
            HttpRequest req,
            CmsLiteDbContext db,
            IBlobRepo blobs,
            IDirectoryRepo directoryRepo,
            ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            (tenant, resource) = Utilities.ParseTenantResource(tenant, resource);

            // Validate content type is specified
            if (string.IsNullOrEmpty(req.ContentType))
            {
                return Results.BadRequest("Content-Type header is required. Supported types: application/json, application/xml, text/xml, application/pdf, text/csv");
            }

            // Parse and validate supported content type
            SupportedContentType contentType;
            try
            {
                contentType = Utilities.ParseContentType(req.ContentType);
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(ex.Message);
            }
            using var ms = new MemoryStream();
            await req.Body.CopyToAsync(ms);
            var bytes = ms.ToArray();
            if (bytes.Length == 0) return Results.BadRequest("Empty body.");

            // Validate content format
            if (contentType == SupportedContentType.Pdf)
            {
                // Use comprehensive PDF validation with PdfSharp
                var pdfValidationOptions = new PdfValidationOptions
                {
                    MaxFileSizeBytes = 8388608, // 8 MB
                    MaxPageCount = 1000,
                    AllowPasswordProtected = false,
                    ScanForEmbeddedFiles = true,
                    ScanForJavaScript = true
                };

                var pdfValidationResult = PdfValidator.ValidatePdf(bytes, pdfValidationOptions, logger);
                if (!pdfValidationResult.IsValid)
                {
                    return Results.BadRequest(pdfValidationResult.ErrorMessage);
                }
            }
            else
            {
                // Use basic validation for JSON, XML, and CSV
                var isValidContent = contentType switch
                {
                    SupportedContentType.Json => Utilities.IsValidJson(bytes),
                    SupportedContentType.Xml => Utilities.IsValidXml(bytes),
                    SupportedContentType.Csv => Utilities.IsValidCsv(bytes),
                    _ => false
                };

                if (!isValidContent)
                {
                    return Results.BadRequest($"Invalid {contentType.ToString().ToLower()} content format.");
                }
            }

            // Calculate content integrity hash
            string sha256;
            using (var sha = SHA256.Create())
            {
                sha256 = Convert.ToHexString(sha.ComputeHash(bytes));
            }
            // Get current item for optimistic concurrency
            var item = await db.ContentItemsTable.SingleOrDefaultAsync(x => x.Tenant.Name == tenant && x.Resource == resource);
            // Handle optimistic concurrency control
            var ifMatch = req.Headers["If-Match"].FirstOrDefault();
            if (!string.IsNullOrEmpty(ifMatch) && item != null && item.ETag != ifMatch)
            {
                return Results.StatusCode(StatusCodes.Status412PreconditionFailed);
            }
            // Determine next version and blob key
            var nextVersion = (item?.LatestVersion ?? 0) + 1;
            var blobKey = Utilities.GenerateBlobKey(tenant, resource, nextVersion, contentType);
            // Get the actual tenant ID from the tenant name
            var (tenantSuccess, tenantId, tenantError) = await DbHelper.GetTenantIdAsync(tenant, db);
            if (!tenantSuccess) return tenantError!;

            // Handle directory assignment
            string directoryId;
            var directoryHeader = req.Headers["X-Directory-Id"].FirstOrDefault();

            if (!string.IsNullOrEmpty(directoryHeader))
            {
                // Validate that the specified directory exists and belongs to the tenant
                var specifiedDirectory = await directoryRepo.GetDirectoryByIdAsync(directoryHeader);
                if (specifiedDirectory == null || specifiedDirectory.TenantId != tenantId || !specifiedDirectory.IsActive)
                {
                    return Results.BadRequest($"Invalid directory ID: {directoryHeader}");
                }
                directoryId = directoryHeader;
            }
            else
            {
                // No directory specified - use or create root directory
                var rootDirectory = await directoryRepo.GetOrCreateRootDirectoryAsync(tenantId);
                directoryId = rootDirectory.Id;
            }
            // Upload blob first, then update database with rollback on failure
            string? uploadedBlobKey = null;
            try
            {
                var (etag, size) = await blobs.UploadAsync(blobKey, bytes); // Generic upload - validation already done above
                uploadedBlobKey = blobKey; // Track for potential cleanup
                try
                {
                    // Update or create content item metadata
                    if (item == null)
                    {
                        item = new DbSet.ContentItem
                        {
                            TenantId = tenantId,
                            DirectoryId = directoryId,
                            Resource = resource,
                            LatestVersion = nextVersion,
                            ContentType = contentType switch
                            {
                                SupportedContentType.Json => "application/json",
                                SupportedContentType.Xml => "application/xml",
                                SupportedContentType.Pdf => "application/pdf",
                                SupportedContentType.Csv => "text/csv",
                                _ => "application/json"
                            },
                            ByteSize = size,
                            Sha256 = sha256,
                            ETag = etag,
                            CreatedAtUtc = DateTime.UtcNow,
                            UpdatedAtUtc = DateTime.UtcNow,
                            IsDeleted = false
                        };
                        db.ContentItemsTable.Add(item);
                    }
                    else
                    {
                        item.LatestVersion = nextVersion;
                        item.ByteSize = size;
                        item.Sha256 = sha256;
                        item.ETag = etag;
                        item.UpdatedAtUtc = DateTime.UtcNow;
                        item.IsDeleted = false;
                        item.ContentType = contentType switch
                        {
                            SupportedContentType.Json => "application/json",
                            SupportedContentType.Xml => "application/xml",
                            SupportedContentType.Pdf => "application/pdf",
                            SupportedContentType.Csv => "text/csv",
                            _ => "application/json"
                        };
                    }
                    // Create version history record
                    db.ContentVersionsTable.Add(new DbSet.ContentVersion
                    {
                        TenantId = tenantId,
                        Resource = resource,
                        Version = nextVersion,
                        ByteSize = size,
                        Sha256 = sha256,
                        ETag = etag,
                        CreatedAtUtc = DateTime.UtcNow
                    });
                    await db.SaveChangesAsync(cancellationToken);
                    return Results.Created($"/v1/{tenant}/{resource}?version={nextVersion}", new { tenant, resource, version = nextVersion, etag, sha256, size = Helpers.Utilities.CalculateFileSizeInBestUnit(size) });
                }
                catch (Exception)
                {
                    // Compensation: Clean up uploaded blob on database failure
                    if (uploadedBlobKey != null)
                    {
                        try
                        {
                            await blobs.DeleteAsync(uploadedBlobKey);
                        }
                        catch
                        {
                            // Log blob cleanup failure but don't throw (avoid masking original exception)
                            // TODO: Implement logging here
                        }
                    }
                    throw; // Re-throw the database exception
                }
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }
        }).WithName("CreateOrUpdateContent")
        .RequireAuthorization()
        .WithSummary("Create or update content")
        .WithDescription("Create new content or update existing content with versioning")
        .RequireRateLimiting("content-write");

        // GET /v1/{tenant}/{resource} - Retrieve content
        contentGroup.MapGet("/{tenant}/{resource}", async (
            string tenant,
            string resource,
            int? version,
            HttpResponse res,
            CmsLiteDbContext db,
            IBlobRepo blobs,
            CancellationToken cancellationToken) =>
        {
            (tenant, resource) = Utilities.ParseTenantResource(tenant, resource);

            // Get the actual tenant ID from the tenant name
            var (tenantSuccess, tenantId, tenantError) = await DbHelper.GetTenantIdAsync(tenant, db);
            if (!tenantSuccess) return tenantError!;

            var latest = await db.ContentItemsTable
                .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Resource == resource && x.IsDeleted == false, cancellationToken);
            if (latest == null) return Results.NotFound();
            var v = version ?? latest.LatestVersion;
            // Determine blob key based on stored content type
            SupportedContentType contentTypeEnum;
            switch (latest.ContentType)
            {
                case "application/json":
                    contentTypeEnum = SupportedContentType.Json;
                    break;
                case "application/xml":
                    contentTypeEnum = SupportedContentType.Xml;
                    break;
                case "application/pdf":
                    contentTypeEnum = SupportedContentType.Pdf;
                    break;
                case "text/csv":
                    contentTypeEnum = SupportedContentType.Csv;
                    break;
                default:
                    return Results.BadRequest($"Unsupported content type: {latest.ContentType}");
            }

            var blobKey = Utilities.GenerateBlobKey(tenant, resource, v, contentTypeEnum);
            var blob = await blobs.DownloadAsync(blobKey);
            if (blob == null) return Results.NotFound();

            res.ContentType = latest.ContentType;
            res.Headers.ETag = blob.Value.ETag;
            await res.Body.WriteAsync(blob.Value.Bytes, cancellationToken);
            return Results.Empty;
        }).RequireAuthorization()
        .WithName("GetContent")
        .WithSummary("Retrieve content")
        .WithDescription("Get content by tenant and resource, optionally specifying version")
        .RequireRateLimiting("content-read");

        // HEAD /v1/{tenant}/{resource} - Get content metadata
        contentGroup.MapMethods("/{tenant}/{resource}", new[] { HttpMethods.Head }, async (
            string tenant,
            string resource,
            int? version,
            HttpResponse res,
            CmsLiteDbContext db,
            IBlobRepo blobs,
            CancellationToken cancellationToken) =>
        {
            (tenant, resource) = Utilities.ParseTenantResource(tenant, resource);

            // Get the actual tenant ID from the tenant name
            var (tenantSuccess, tenantId, tenantError) = await DbHelper.GetTenantIdAsync(tenant, db);
            if (!tenantSuccess) return tenantError!;

            var latest = await db.ContentItemsTable
                .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Resource == resource && x.IsDeleted == false, cancellationToken);
            if (latest == null) return Results.NotFound();

            var v = version ?? latest.LatestVersion;
            // Determine blob key based on stored content type
            var contentTypeEnum = latest.ContentType switch
            {
                "application/xml" => SupportedContentType.Xml,
                "application/pdf" => SupportedContentType.Pdf,
                "text/csv" => SupportedContentType.Csv,
                _ => SupportedContentType.Json
            };
            var blobKey = Utilities.GenerateBlobKey(tenant, resource, v, contentTypeEnum);
            var head = await blobs.HeadAsync(blobKey);
            if (head == null) return Results.NotFound();

            res.ContentType = latest.ContentType;
            res.Headers.ETag = head.Value.ETag;
            res.ContentLength = head.Value.Size;
            return Results.Empty;
        })
        .RequireAuthorization()
        .WithName("GetContentMetadata")
        .WithSummary("Get content metadata")
        .WithDescription("Get content metadata without downloading the content body")
        .RequireRateLimiting("content-read");

        // GET /v1/{tenant} - List tenant resources
        contentGroup.MapGet("/{tenant}", async (
            string tenant,
            string? prefix,
            bool? includeDeleted,
            int? limit,
            string? cursor,
            CmsLiteDbContext db,
            CancellationToken cancellationToken) =>
        {
            var take = Math.Clamp(limit ?? 50, 1, 200);
            // Get the actual tenant ID from the tenant name
            var (tenantSuccess, tenantId, tenantError) = await DbHelper.GetTenantIdAsync(tenant, db);
            if (!tenantSuccess) return tenantError!;

            var q = db.ContentItemsTable.AsQueryable().Where(x => x.TenantId == tenantId);

            if (!(includeDeleted ?? false))
                q = q.Where(x => x.IsDeleted == false);

            if (!string.IsNullOrEmpty(prefix))
            {
                q = q.Where(x => x.Resource.StartsWith(prefix));
            }

            // Cursor-based pagination using Id
            int afterId = 0;
            if (!string.IsNullOrEmpty(cursor) && int.TryParse(cursor, out var c))
                afterId = c;

            var page = await q.Where(x => x.Id > afterId)
                            .OrderBy(x => x.Id)
                            .Take(take + 1)
                            .ToListAsync(cancellationToken);

            string? next = page.Count > take ? page[^1].Id.ToString() : null;
            if (page.Count > take) page.RemoveAt(page.Count - 1);

            var items = page.Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Resource,
                x.LatestVersion,
                x.ETag,
                x.ByteSize,
                x.Sha256,
                x.UpdatedAtUtc
            });

            return Results.Ok(new { items, nextCursor = next });
        })
        .WithName("ListTenantResources")
        .WithSummary("List tenant resources")
        .WithDescription("List all resources for a tenant with optional filtering and pagination")
        .RequireRateLimiting("content-read");

        // DELETE /v1/{tenant}/{resource} - Soft delete single content
        contentGroup.MapDelete("/{tenant}/{resource}", async (
            string tenant,
            string resource,
            CmsLiteDbContext db,
            CancellationToken cancellationToken) =>
        {
            (tenant, resource) = Utilities.ParseTenantResource(tenant, resource);

            // Get the actual tenant ID from the tenant name
            var (tenantSuccess, tenantId, tenantError) = await DbHelper.GetTenantIdAsync(tenant, db);
            if (!tenantSuccess) return tenantError!;

            var item = await db.ContentItemsTable
                .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Resource == resource && x.IsDeleted == false);
            if (item == null) return Results.NotFound();

            item.IsDeleted = true;
            item.UpdatedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);

            return Results.NoContent();
        }).RequireAuthorization()
        .WithName("DeleteContent")
        .WithSummary("Soft delete content")
        .WithDescription("Mark content as deleted (soft delete)")
        .RequireRateLimiting("content-write");

        // DELETE /v1/{tenant}/bulk-delete - Bulk soft delete content
        contentGroup.MapDelete("/{tenant}/bulk-delete", async (
            string tenant,
            HttpRequest request, // NOTE: Using HttpRequest instead of SoftDeleteRequest model binding
                                // due to .NET 8 Minimal API limitation with DELETE + request body + authorization.
                                // Direct model binding causes authorization middleware conflicts on DELETE endpoints.
            CmsLiteDbContext db,
            IDirectoryRepo directoryRepo,
            CancellationToken cancellationToken) =>
        {
            tenant = tenant.Trim();

            // Read and parse JSON request body manually (see comment above for why)
            var deleteRequest = await request.ReadFromJsonAsync<SoftDeleteRequest>(cancellationToken);
            if (deleteRequest == null)
            {
                return Results.BadRequest(new SoftDeleteErrorResponse
                {
                    Error = "BadRequest",
                    Details = "Request body is required",
                    ValidationFailure = "Empty or null request body"
                });
            }

            // Get the actual tenant ID from the tenant name
            var (tenantSuccess, tenantId, tenantError) = await DbHelper.GetTenantIdAsync(tenant, db);
            if (!tenantSuccess) return tenantError!;

            // Validate input
            if (deleteRequest.Resources == null || deleteRequest.Resources.Count == 0)
            {
                return Results.BadRequest(new SoftDeleteErrorResponse
                {
                    Error = "BadRequest",
                    Details = "At least one resource is required",
                    ValidationFailure = "Empty resources list"
                });
            }

            // Clean and validate resource names
            var cleanResources = deleteRequest.Resources
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Select(r => r.Trim())
                .Distinct()
                .ToList();

            if (cleanResources.Count == 0)
            {
                return Results.BadRequest(new SoftDeleteErrorResponse
                {
                    Error = "BadRequest",
                    Details = "No valid resources provided",
                    ValidationFailure = "All resources are empty or whitespace"
                });
            }

            // Begin atomic transaction
            using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                // Fetch all resources to delete
                var itemsToDelete = await db.ContentItemsTable
                    .Include(x => x.Directory)
                    .Where(x => x.TenantId == tenantId &&
                               cleanResources.Contains(x.Resource) &&
                               !x.IsDeleted)
                    .ToListAsync(cancellationToken);

                // Check if any resources were not found
                var foundResources = itemsToDelete.Select(x => x.Resource).ToHashSet();
                var missingResources = cleanResources.Where(r => !foundResources.Contains(r)).ToList();

                if (missingResources.Count > 0)
                {
                    return Results.BadRequest(new SoftDeleteErrorResponse
                    {
                        Error = "NotFound",
                        Details = "Some resources were not found or already deleted",
                        FailedResources = missingResources,
                        ValidationFailure = $"Missing resources: {string.Join(", ", missingResources)}"
                    });
                }

                // Validate all resources belong to the same directory
                var directoryIds = itemsToDelete.Select(x => x.DirectoryId).Distinct().ToList();
                if (directoryIds.Count > 1)
                {
                    return Results.BadRequest(new SoftDeleteErrorResponse
                    {
                        Error = "BadRequest",
                        Details = "All resources must belong to the same directory",
                        ValidationFailure = $"Resources span across {directoryIds.Count} different directories"
                    });
                }

                var directoryId = directoryIds.First();
                var directory = await directoryRepo.GetDirectoryByIdAsync(directoryId);
                var directoryPath = await BuildDirectoryFullPathAsync(directory!, db);

                // Perform soft delete on all items
                var deletedAtUtc = DateTime.UtcNow;
                var deletedResources = new List<DeletedResourceInfo>();

                foreach (var item in itemsToDelete)
                {
                    item.IsDeleted = true;
                    item.UpdatedAtUtc = deletedAtUtc;

                    deletedResources.Add(new DeletedResourceInfo
                    {
                        Resource = item.Resource,
                        LatestVersion = item.LatestVersion,
                        ContentType = item.ContentType,
                        Size = Utilities.CalculateFileSizeInBestUnit(item.ByteSize),
                        OriginalCreatedAtUtc = item.CreatedAtUtc
                    });
                }

                // Save changes
                await db.SaveChangesAsync(cancellationToken);

                // Commit transaction
                await transaction.CommitAsync(cancellationToken);

                // Return success response
                var response = new SoftDeleteResponse
                {
                    TenantId = tenantId,
                    TenantName = tenant,
                    DirectoryId = directoryId,
                    DirectoryPath = directoryPath,
                    DeletedCount = deletedResources.Count,
                    DeletedResources = deletedResources,
                    DeletedAtUtc = deletedAtUtc
                };

                return Results.Ok(response);
            }
            catch (Exception ex)
            {
                // Rollback transaction on any error
                await transaction.RollbackAsync(cancellationToken);

                return Results.BadRequest(new SoftDeleteErrorResponse
                {
                    Error = "TransactionFailed",
                    Details = $"Failed to delete resources: {ex.Message}",
                    ValidationFailure = "Database transaction failed"
                });
            }
        }).RequireAuthorization()
        .WithName("BulkDeleteContent")
        .WithSummary("Bulk soft delete multiple content resources")
        .WithDescription("Soft delete multiple content resources in a single atomic transaction. All resources must belong to the same directory and tenant. Features: atomic operations, same directory validation, duplicate handling, comprehensive response, and transaction rollback on any failure. Supports up to 10 resources per request.")
        .RequireRateLimiting("bulk-operations");

        // GET /v1/{tenant}/{resource}/versions - List content versions
        contentGroup.MapGet("/{tenant}/{resource}/versions", async (
            string tenant,
            string resource,
            CmsLiteDbContext db,
            CancellationToken cancellationToken) =>
        {
            (tenant, resource) = Utilities.ParseTenantResource(tenant, resource);
            // Get the actual tenant ID from the tenant name
            var (tenantSuccess, tenantId, tenantError) = await DbHelper.GetTenantIdAsync(tenant, db);
            if (!tenantSuccess) return tenantError!;

            var versions = await db.ContentVersionsTable
                .Where(x => x.TenantId == tenantId && x.Resource == resource)
                .OrderByDescending(x => x.Version)
                .Select(x => new
                {
                    x.Version,
                    x.ETag,
                    x.Sha256,
                    x.ByteSize,
                    x.CreatedAtUtc
                })
                .ToListAsync(cancellationToken);

            if (versions.Count == 0) return Results.NotFound();
            return Results.Ok(versions);
        }).RequireAuthorization()
        .WithName("GetContentVersions")
        .WithSummary("List content versions")
        .WithDescription("Get all versions of a specific content resource")
        .RequireRateLimiting("content-read");

        // GET /v1/{tenant}/{resource}/details - Get detailed content information
        contentGroup.MapGet("/{tenant}/{resource}/details", async (
            string tenant,
            string resource,
            CmsLiteDbContext db,
            IContentItemRepo contentItemRepo,
            CancellationToken cancellationToken) =>
        {
            (tenant, resource) = Utilities.ParseTenantResource(tenant, resource);

            // Get the actual tenant ID from the tenant name
            var (tenantSuccess, tenantId, tenantError) = await DbHelper.GetTenantIdAsync(tenant, db);
            if (!tenantSuccess) return tenantError!;

            try
            {
                var contentDetails = await contentItemRepo.GetContentItemDetailsAsync(tenantId, resource);

                if (contentDetails == null)
                {
                    return Results.NotFound($"Content resource '{resource}' not found in tenant '{tenant}'");
                }

                return Results.Ok(contentDetails);
            }
            catch (Exception ex)
            {
                // TODO: Implement proper logging
                Console.WriteLine($"Error getting content details: {ex.Message}");
                return Results.Problem("An error occurred while retrieving content details");
            }
        }).RequireAuthorization()
        .WithName("GetContentDetails")
        .WithSummary("Get detailed content information")
        .WithDescription("Returns comprehensive details about a specific content resource including version history, directory info, and metadata")
        .RequireRateLimiting("content-read");
    }

    // Helper method to build directory full path
    private static async Task<string> BuildDirectoryFullPathAsync(DbSet.Directory directory, CmsLiteDbContext db)
    {
        var pathParts = new List<string>();
        var current = directory;

        while (current != null)
        {
            if (current.ParentId == null)
            {
                // This is root directory, don't include it in path unless it has a meaningful name
                if (current.Name != "Root")
                {
                    pathParts.Insert(0, current.Name);
                }
                break;
            }

            pathParts.Insert(0, current.Name);
            current = await db.DirectoriesTable.FirstOrDefaultAsync(d => d.Id == current.ParentId);
        }

        if (pathParts.Count == 0)
        {
            return "/";
        }
        var sb = new System.Text.StringBuilder();
        sb.Append('/');
        for (int i = 0; i < pathParts.Count; i++)
        {
            sb.Append(pathParts[i]);
            if (i < pathParts.Count - 1)
            {
                sb.Append('/');
            }
        }
        return sb.ToString();
    }
}