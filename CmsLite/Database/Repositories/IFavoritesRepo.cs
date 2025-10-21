using System;

namespace CmsLite.Database.Repositories;

public interface IFavoritesRepo
{
    Task<DbSet.ContentItem?> GetFavoriteByIdAsync(string favoriteId, CancellationToken cancellationToken);
    Task AddFavoriteAsync(DbSet.ContentItem contentItem, CancellationToken cancellationToken);
    Task RemoveFavoriteAsync(string favoriteId, CancellationToken cancellationToken);
    Task<List<DbSet.ContentItem>> GetFavoritesByUserIdAsync(string userId, CancellationToken cancellationToken);
}
