using System;
using Microsoft.EntityFrameworkCore;
using CmsLite.Database;
using static CmsLite.Database.DbSet;

namespace CmsLite.Database.Repositories;

public class FavoriteRepo : IFavoriteRepo
{
    private readonly CmsLiteDbContext dbContext;

    public FavoriteRepo(CmsLiteDbContext dbContext)
    {
        this.dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
    }

    public async Task AddFavoriteAsync(int contentItemId, string userId, CancellationToken cancellationToken)
    {
        try
        {
            var favorite = new Favorite
            {
                Id = Guid.NewGuid().ToString(),
                UserId = userId,
                ContentItemId = contentItemId
            };
            dbContext.FavoritesTable.Add(favorite);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            throw new InvalidOperationException("Could not add favorite due to a database error.", ex);
        }


    }

    public async Task<DbSet.ContentItem?> GetFavoriteByIdAsync(string favoriteId, CancellationToken cancellationToken)
    {
        var favorite = await dbContext.FavoritesTable
            .Include(f => f.ContentItem)
            .FirstOrDefaultAsync(f => f.Id == favoriteId, cancellationToken);
        return favorite?.ContentItem;
    }

    public async Task<List<DbSet.ContentItem>> GetFavoritesByUserIdAsync(string userId, CancellationToken cancellationToken)
    {
        var favorites = await dbContext.FavoritesTable
            .Include(f => f.ContentItem)
            .Where(f => f.UserId == userId)
            .ToListAsync(cancellationToken);
        return favorites.Select(f => f.ContentItem).ToList();
    }

    public async Task RemoveFavoriteAsync(string favoriteId, CancellationToken cancellationToken)
    {
        var favorite = await dbContext.FavoritesTable.FindAsync(new object[] { favoriteId }, cancellationToken);
        if (favorite != null)
        {
            dbContext.FavoritesTable.Remove(favorite);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<bool> FavoriteExistsAsync(int contentItemId, string userId, CancellationToken cancellationToken)
    {
        return await dbContext.FavoritesTable.AnyAsync(f => f.ContentItemId == contentItemId && f.UserId == userId, cancellationToken);
    }

    public async Task<bool> FavoriteExistsAsyncByDirectoryResourceId(string directoryId, string resourceName, string userId, CancellationToken cancellationToken)
    {
        return await dbContext.FavoritesTable
            .Include(f => f.ContentItem)
            .AnyAsync(f => f.ContentItem.DirectoryId == directoryId && f.ContentItem.Resource.Equals(resourceName, StringComparison.InvariantCultureIgnoreCase) && f.UserId == userId, cancellationToken);
    }
}