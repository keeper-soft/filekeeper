using System;
using System.ComponentModel.DataAnnotations;

namespace CmsLite.Helpers.RequestMappers;

public record GetFavoritesRequest
{
    [Required]
    public string UserId { get; init; } = string.Empty;
}

public record AddFavoriteRequest
{
    [Required]
    public string UserId { get; init; } = string.Empty;

    [Required]
    public string ContentId { get; init; } = string.Empty;

    public static string GetDirectoryIdFromContentId(string contentId)
    {
        var parts = contentId.Split(':');
        return parts.Length == 2 ? parts[0] : string.Empty;
    }

    public static string GetResourceNameFromContentId(string contentId)
    {
        var parts = contentId.Split(':');
        return parts.Length == 2 ? parts[1] : string.Empty;
    }

}

