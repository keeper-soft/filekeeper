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
    public int ContentId { get; init; }
}
