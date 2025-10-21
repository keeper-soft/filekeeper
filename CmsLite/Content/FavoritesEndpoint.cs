using System;
using System.Security.Claims;
using CmsLite.Database;
using CmsLite.Database.Repositories;
using CmsLite.Helpers;
using CmsLite.Helpers.RequestMappers;
using static CmsLite.Database.DbSet;
namespace CmsLite.Content;

public static class FavoriteEndpoint
{
    public static void MapFavoritesEndpoint(this IEndpointRouteBuilder app)
    {
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
            if (string.IsNullOrEmpty(favoriteItem.ContentId))
            {
                return Results.BadRequest("ContentId is required.");
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

        app.MapDelete("/v1/favorites/{contentId}", async (ICmsLiteDbContext dbContext, IFavoriteRepo favoriteRepo, HttpContext context, CancellationToken cancellationToken) =>
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
            var contentId = context.Request.RouteValues["contentId"]?.ToString();
            if (string.IsNullOrEmpty(contentId))
            {
                return Results.BadRequest("ContentId is required.");
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
            await favoriteRepo.RemoveFavoriteAsync(contentId, cancellationToken);
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
