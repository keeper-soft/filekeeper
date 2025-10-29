using System;

namespace CmsLite.Database.Repositories;

public interface IFavoriteRepo
{
    Task<DbSet.ContentItem?> GetFavoriteByIdAsync(string favoriteId, CancellationToken cancellationToken);
    Task AddFavoriteAsync(int contentItemId, string userId, CancellationToken cancellationToken);
    Task RemoveFavoriteAsync(string favoriteId, CancellationToken cancellationToken);
    Task<List<DbSet.ContentItem>> GetFavoritesByUserIdAsync(string userId, CancellationToken cancellationToken);
    Task<bool> FavoriteExistsAsync(int contentItemId, string userId, CancellationToken cancellationToken);

}
