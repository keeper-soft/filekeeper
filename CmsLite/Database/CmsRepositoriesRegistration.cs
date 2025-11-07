using System;
using CmsLite.Database.Repositories;
namespace CmsLite.Database;


public static class CmsRepositoriesRegistration
{
    /// <summary>
    /// Register all the repositories required
    /// <param name="builder">
    /// The WebApplicationBuilder to add repositories to
    /// </param>
    /// </summary>
    public static void AddCmsRepositories(this WebApplicationBuilder builder)
    {
        // Register repositories
        builder.Services.AddScoped<IUserRepo, UserRepo>();
        builder.Services.AddScoped<IUserSessionRepo, UserSessionRepo>();
        builder.Services.AddScoped<ITenantRepo, TenantRepo>();
        builder.Services.AddScoped<IDirectoryRepo, DirectoryRepo>();
        builder.Services.AddScoped<IContentItemRepo, ContentItemRepo>();
        builder.Services.AddScoped<IFavoriteRepo, FavoriteRepo>();
    }
}
