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
        app.MapGet("/v1/{tenant}/favorites", async (string tenant, CmsLiteDbContext dbContext, IFavoriteRepo favoriteRepo, HttpContext context, CancellationToken cancellationToken) =>
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

        app.MapPost("/v1/{tenant}/favorites", async (
            string tenant,
            CmsLiteDbContext dbContext,
            IFavoriteRepo favoriteRepo,
            IContentItemRepo contentItemRepo,
            HttpContext context,
            CancellationToken cancellationToken) =>
        {
            try
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
                if (string.IsNullOrEmpty(favoriteItem.UserId))
                {
                    return Results.BadRequest("UserId is required.");
                }
                if (favoriteItem.UserId != userId)
                {
                    return Results.Unauthorized();
                }
                if (!isValid)
                {
                    return Results.Unauthorized();
                }
                var directoryId = Utilities.ExtractDirectoryIdFromContentId(favoriteItem.ContentId);
                var resourceName = Utilities.ExtractResourceNameFromContentId(favoriteItem.ContentId);
                var favoriteAlreadyExists = await favoriteRepo.FavoriteExistsAsyncByDirectoryResourceId(directoryId, resourceName, favoriteItem.UserId, cancellationToken);
                if (favoriteAlreadyExists)
                {
                    return Results.Conflict("Favorite already exists.");
                }
                var contentItemId = await contentItemRepo.GetContentItemIdByDirectoryAndResourceAsync(directoryId, resourceName, cancellationToken);
                if (contentItemId == null || contentItemId <= 0)
                {
                    return Results.BadRequest("Content item does not exist.");
                }
                await favoriteRepo.AddFavoriteAsync(contentItemId.Value, favoriteItem.UserId, cancellationToken);
                return Results.Created($"/favorites/{favoriteItem.ContentId}", favoriteItem.ContentId);
            }
            catch (Exception ex)
            {
                return Results.Problem($"An error occurred while adding the favorite: {ex.Message}");
            }
        })
        .RequireAuthorization()
        .RequireRateLimiting("content-write")
        .WithTags("Favorites")
        .WithSummary("Add Favorite")
        .WithDescription("Adds a content item to the authenticated user's favorites.")
        .Produces<Favorite>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status500InternalServerError);

        app.MapDelete("/v1/{tenant}/favorites/{contentId}", async (
            string tenant,
            string contentId,
            CmsLiteDbContext dbContext,
            IContentItemRepo contentItemRepo,
            IFavoriteRepo favoriteRepo,
            HttpContext context,
            CancellationToken cancellationToken) =>
        {
            try
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
                if (string.IsNullOrEmpty(contentId))
                {
                    return Results.BadRequest("ContentId is required.");
                }
                var (isValid, errorResult) = await DbHelper.ValidateUserTenantAsync(userId, tenantId, dbContext);
                if (!isValid)
                {
                    return Results.Unauthorized();
                }
                var directoryID = Utilities.ExtractDirectoryIdFromContentId(contentId);
                var resourceName = Utilities.ExtractResourceNameFromContentId(contentId);
                var favoriteAlreadyExists = await favoriteRepo.FavoriteExistsAsyncByDirectoryResourceId(directoryID, resourceName, userId, cancellationToken);
                if (!favoriteAlreadyExists)
                {
                    return Results.NotFound("Favorite does not exist.");
                }
                var contentItemId = await contentItemRepo.GetContentItemIdByDirectoryAndResourceAsync(directoryID, resourceName, cancellationToken);
                await favoriteRepo.RemoveFavoriteByContentItemIdAsync(contentItemId.Value, userId, cancellationToken);
                return Results.NoContent();
            }
            catch (Exception ex)
            {
                return Results.Problem($"An error occurred while removing the favorite: {ex.Message}");
            }
        })
        .RequireAuthorization()
        .RequireRateLimiting("content-write")
        .WithTags("Favorites")
        .WithSummary("Remove Favorite")
        .WithDescription("Removes a content item from the authenticated user's favorites.")
        .Produces(StatusCodes.Status204NoContent)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);
    }
}
