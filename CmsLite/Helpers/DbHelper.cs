using System;
using CmsLite.Database;
using Microsoft.EntityFrameworkCore;

namespace CmsLite.Helpers;

public class DbHelper
{
    // Get TenantId from Tenant Name
    public static async Task<(bool Success, string TenantId, IResult? ErrorResult)> GetTenantIdAsync(string tenantName, ICmsLiteDbContext db)
    {
        var tenantEntity = await db.Tenants.FirstOrDefaultAsync(t => t.Name == tenantName);
        if (tenantEntity == null)
        {
            return (false, string.Empty, Results.BadRequest($"Tenant '{tenantName}' not found"));
        }
        return (true, tenantEntity.Id, null);
    }

    // Validate if User id from token exists in database
    public static async Task<(bool Success, string UserId, IResult? ErrorResult)> ValidateUserIdAsync(string userId, ICmsLiteDbContext db)
    {
        var userEntity = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (userEntity == null)
        {
            return (false, string.Empty, Results.Unauthorized());
        }
        return (true, userEntity.Id, null);
    }

    // Validate if UserId belongs to the specified TenantId
    public static async Task<(bool Success, IResult? ErrorResult)> ValidateUserTenantAsync(string userId, string tenantId, ICmsLiteDbContext db)
    {
        var userEntity = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId);
        if (userEntity == null)
        {
            return (false, Results.Unauthorized());
        }
        return (true, null);
    }

}
