using System;
using System.Security.Claims;
using CmsLite.Database;
using CmsLite.Database.Repositories;
using CmsLite.Helpers;
using CmsLite.Helpers.RequestMappers;
using static CmsLite.Database.DbSet;
namespace CmsLite.Content;

/// <summary>
/// Provides endpoint mappings for managing user favorites.
/// Handles operations to retrieve, add, and remove favorite content items for authenticated users.
/// </summary>
public static class FavoriteEndpoint
{
    /// <summary>
    /// Maps all favorite-related endpoints to the application's route builder.
    /// Configures GET, POST, and DELETE endpoints for favorite management with authorization and rate limiting.
    /// </summary>
    /// <param name="app">The endpoint route builder to which the favorite endpoints will be mapped.</param>
    public static void MapFavoritesEndpoint(this IEndpointRouteBuilder app)
    {
        /// <summary>
        /// GET /v1/favorites - Retrieves all favorite content items for the authenticated user.
        /// </summary>
        /// <remarks>
        /// Extracts from HttpContext:
        /// - ClaimTypes.PrimarySid: User ID from JWT token claims
        /// - ClaimTypes.GroupSid: Tenant ID from JWT token claims
        /// 
        /// Validates user-tenant association before returning favorites.
        /// </remarks>
        /// <param name="dbContext">Database context for user/tenant validation.</param>
        /// <param name="favoriteRepo">Repository for favorite operations.</param>
        /// <param name="context">HTTP context containing user claims from authentication.</param>
        /// <param name="cancellationToken">Cancellation token for async operations.</param>
        /// <returns>
        /// 200 OK with List&lt;Favorite&gt; - User's favorite content items.
        /// 401 Unauthorized - Missing or invalid user/tenant claims, or user-tenant validation failed.
        /// </returns>
        app.MapGet("/v1/favorites", async (ICmsLiteDbContext dbContext, IFavoriteRepo favoriteRepo, HttpContext context, CancellationToken cancellationToken) =>
        {
            var userId = context.User.FindFirst(ClaimTypes.PrimarySid)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }
            var tenantId = context.User.FindFirst(ClaimTypes.GroupSid)?.Value;
            if (string.IsNullOrEmpty(tenantId))
            {
                return Results.Unauthorized();
            }
            var (isValid, errorResult) = await DbHelper.ValidateUserTenantAsync(userId, tenantId, dbContext);
            if (!isValid)
            {
                return Results.Unauthorized();
            }
            var favorites = await favoriteRepo.GetFavoritesByUserIdAsync(userId, cancellationToken);
            return Results.Ok(favorites);
        })
        .RequireAuthorization()
        .RequireRateLimiting("content-read")
        .WithTags("Favorites")
        .WithSummary("Get Favorites")
        .WithDescription("Retrieves the list of favorite content items for the authenticated user.")
        .Produces<List<Favorite>>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized);

        /// <summary>
        /// POST /v1/favorites - Adds a content item to the authenticated user's favorites.
        /// </summary>
        /// <remarks>
        /// Extracts from HttpContext:
        /// - ClaimTypes.PrimarySid: User ID from JWT token claims
        /// - ClaimTypes.GroupSid: Tenant ID from JWT token claims
        /// 
        /// Parses from Request Body (JSON):
        /// - AddFavoriteRequest.UserId: User ID making the favorite request
        /// - AddFavoriteRequest.ContentId: Content item ID to add as favorite
        /// 
        /// Validation performed:
        /// - User-tenant association validation
        /// - UserId from token must match UserId in request body
        /// - ContentId must be a positive integer
        /// - Favorite must not already exist
        /// </remarks>
        /// <param name="dbContext">Database context for user/tenant validation.</param>
        /// <param name="favoriteRepo">Repository for favorite operations.</param>
        /// <param name="context">HTTP context containing user claims and request body.</param>
        /// <param name="cancellationToken">Cancellation token for async operations.</param>
        /// <returns>
        /// 201 Created - Favorite successfully added, location header with /favorites/{contentId}.
        /// 400 Bad Request - Invalid request body, missing UserId, or invalid ContentId.
        /// 401 Unauthorized - Missing/invalid claims or UserId mismatch.
        /// 409 Conflict - Favorite already exists.
        /// </returns>
        app.MapPost("/v1/favorites", async (ICmsLiteDbContext dbContext, IFavoriteRepo favoriteRepo, HttpContext context, CancellationToken cancellationToken) =>
        {
            var userId = context.User.FindFirst(ClaimTypes.PrimarySid)?.Value;
            var tenantId = context.User.FindFirst(ClaimTypes.GroupSid)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }
            if (string.IsNullOrEmpty(tenantId))
            {
                return Results.Unauthorized();
            }
            var favoriteItem = await context.Request.ReadFromJsonAsync<AddFavoriteRequest>(cancellationToken: cancellationToken);
            var (isValid, errorResult) = await DbHelper.ValidateUserTenantAsync(userId, tenantId, dbContext);
            if (favoriteItem is null)
            {
                return Results.BadRequest();
            }
            if (favoriteItem.UserId != userId)
            {
                return Results.Unauthorized();
            }
            if (favoriteItem.ContentId <= 0)
            {
                return Results.BadRequest("ContentId must be a positive integer.");
            }
            if (string.IsNullOrEmpty(favoriteItem.UserId))
            {
                return Results.BadRequest("UserId is required.");
            }
            if (!isValid)
            {
                return Results.Unauthorized();
            }
            var favoriteAlreadyExists = await favoriteRepo.FavoriteExistsAsync(favoriteItem.ContentId, favoriteItem.UserId, cancellationToken);
            if (favoriteAlreadyExists)
            {
                return Results.Conflict("Favorite already exists.");
            }
            await favoriteRepo.AddFavoriteAsync(favoriteItem.ContentId, favoriteItem.UserId, cancellationToken);
            return Results.Created($"/favorites/{favoriteItem.ContentId}", favoriteItem.ContentId);
        })
        .RequireAuthorization()
        .RequireRateLimiting("content-write")
        .WithTags("Favorites")
        .WithSummary("Add Favorite")
        .WithDescription("Adds a content item to the authenticated user's favorites.")
        .Produces<Favorite>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status409Conflict);

        /// <summary>
        /// DELETE /v1/favorites/{contentId} - Removes a content item from the authenticated user's favorites.
        /// </summary>
        /// <remarks>
        /// Extracts from Route:
        /// - contentId: Content item ID to remove from favorites (must be positive integer)
        /// 
        /// Extracts from HttpContext:
        /// - ClaimTypes.PrimarySid: User ID from JWT token claims
        /// - ClaimTypes.GroupSid: Tenant ID from JWT token claims
        /// 
        /// Validation performed:
        /// - User-tenant association validation
        /// - ContentId must be a positive integer
        /// - Favorite must exist before removal
        /// </remarks>
        /// <param name="contentId">Content item ID from route parameter.</param>
        /// <param name="dbContext">Database context for user/tenant validation.</param>
        /// <param name="favoriteRepo">Repository for favorite operations.</param>
        /// <param name="context">HTTP context containing user claims from authentication.</param>
        /// <param name="cancellationToken">Cancellation token for async operations.</param>
        /// <returns>
        /// 204 No Content - Favorite successfully removed.
        /// 400 Bad Request - ContentId is not a positive integer.
        /// 401 Unauthorized - Missing/invalid claims or user-tenant validation failed.
        /// 404 Not Found - Favorite does not exist.
        /// </returns>
        app.MapDelete("/v1/favorites/{contentId:int}", async (int contentId, ICmsLiteDbContext dbContext, IFavoriteRepo favoriteRepo, HttpContext context, CancellationToken cancellationToken) =>
        {
            var userId = context.User.FindFirst(ClaimTypes.PrimarySid)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }
            var tenantId = context.User.FindFirst(ClaimTypes.GroupSid)?.Value;
            if (string.IsNullOrEmpty(tenantId))
            {
                return Results.Unauthorized();
            }
            if (contentId <= 0)
            {
                return Results.BadRequest("ContentId must be a positive integer.");
            }
            var (isValid, errorResult) = await DbHelper.ValidateUserTenantAsync(userId, tenantId, dbContext);
            if (!isValid)
            {
                return Results.Unauthorized();
            }
            var favoriteAlreadyExists = await favoriteRepo.FavoriteExistsAsync(contentId, userId, cancellationToken);
            if (!favoriteAlreadyExists)
            {
                return Results.NotFound("Favorite does not exist.");
            }
            await favoriteRepo.RemoveFavoriteAsync(contentId.ToString(), cancellationToken);
            return Results.NoContent();
        })
        .RequireAuthorization()
        .RequireRateLimiting("content-write")
        .WithTags("Favorites")
        .WithSummary("Remove Favorite")
        .WithDescription("Removes a content item from the authenticated user's favorites.")
        .Produces(StatusCodes.Status204NoContent)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound);
    }
}
