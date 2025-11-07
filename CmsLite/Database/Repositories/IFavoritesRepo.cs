using System;

namespace CmsLite.Database.Repositories;

public interface IFavoriteRepo
{
    Task<DbSet.ContentItem?> GetFavoriteByIdAsync(string favoriteId, CancellationToken cancellationToken);
    Task AddFavoriteAsync(int contentItemId, string userId, CancellationToken cancellationToken);
    Task RemoveFavoriteAsync(string favoriteId, CancellationToken cancellationToken);
    Task RemoveFavoriteByContentItemIdAsync(int contentItemId, string userId, CancellationToken cancellationToken);
    Task<List<DbSet.ContentItem>> GetFavoritesByUserIdAsync(string userId, CancellationToken cancellationToken);
    Task<bool> FavoriteExistsAsync(int contentItemId, string userId, CancellationToken cancellationToken);

    /// <summary>
    /// Checks if a favorite exists for a user based on directory ID and resource name.
    /// </summary>
    /// <param name="directoryId">ID of the directory</param>
    /// <param name="resourceName">Name of the resource it should be case sensitive</param>
    /// <param name="userId">ID of the user</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if the favorite exists, otherwise false</returns>
    Task<bool> FavoriteExistsAsyncByDirectoryResourceId(
        string directoryId,
        string resourceName,
        string userId,
        CancellationToken cancellationToken);

}
