using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CmsLite.Database;
using CmsLite.Helpers;
using CmsLite.Helpers.RequestMappers;
using CmsLiteTests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CmsLiteTests;

public class FavoritesApiTests
{
    #region Helper Method Tests

    [Theory]
    [InlineData("dir123:myfile.json", "dir123", "myfile.json")]
    [InlineData("abc-def-ghi:document.pdf", "abc-def-ghi", "document.pdf")]
    [InlineData("root:home", "root", "home")]
    [InlineData("uuid-1234:test-resource.xml", "uuid-1234", "test-resource.xml")]
    public void GetDirectoryIdFromContentId_ValidFormat_ReturnsDirectoryId(string contentId, string expectedDirectoryId, string expectedResourceName)
    {
        // Act
        var directoryId = Utilities.ExtractDirectoryIdFromContentId(contentId);
        var resourceName = Utilities.ExtractResourceNameFromContentId(contentId);

        // Assert
        Assert.Equal(expectedDirectoryId, directoryId);
        Assert.Equal(expectedResourceName, resourceName);
    }

    [Theory]
    [InlineData("invalid-format")]
    [InlineData("no-colon-separator")]
    [InlineData("")]
    [InlineData("too:many:colons:here")]
    public void GetDirectoryIdFromContentId_InvalidFormat_ReturnsEmpty(string contentId)
    {
        // Act
        var directoryId = Utilities.ExtractDirectoryIdFromContentId(contentId);
        var resourceName = Utilities.ExtractResourceNameFromContentId(contentId);

        // Assert
        Assert.Equal(string.Empty, directoryId);
        Assert.Equal(string.Empty, resourceName);
    }

    #endregion

    #region End-to-End API Tests

    [Fact]
    public async Task AddFavorite_ValidContentItem_ReturnsCreated()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        // First, create a content item to favorite
        var contentPayload = new { title = "My Favorite Document" };
        var contentJson = JsonSerializer.Serialize(contentPayload);
        var contentRequest = new StringContent(contentJson, Encoding.UTF8, "application/json");

        var createContentResponse = await client.PutAsync($"/api/v1/{factory.TestTenant}/favorite-doc.json", contentRequest);
        Assert.Equal(HttpStatusCode.Created, createContentResponse.StatusCode);

        // Get the directory ID from the database
        string? directoryId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CmsLiteDbContext>();
            var contentItem = await db.ContentItemsTable
                .Include(ci => ci.Directory)
                .FirstOrDefaultAsync(ci => ci.Resource == "favorite-doc.json");
            Assert.NotNull(contentItem);
            directoryId = contentItem.DirectoryId;
        }

        // Now add it to favorites using the directoryId:resourceName format
        var addFavoriteRequest = new AddFavoriteRequest
        {
            UserId = factory.TestUser,
            ContentId = $"{directoryId}:favorite-doc.json"
        };

        // Act
        var response = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addFavoriteRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        // Verify in database
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CmsLiteDbContext>();
            var favorite = await db.FavoritesTable
                .Include(f => f.ContentItem)
                .FirstOrDefaultAsync(f => f.UserId == factory.TestUser);

            Assert.NotNull(favorite);
            Assert.Equal("favorite-doc.json", favorite.ContentItem.Resource);
            Assert.Equal(directoryId, favorite.ContentItem.DirectoryId);
        }
    }

    [Fact]
    public async Task AddFavorite_DuplicateFavorite_ReturnsConflict()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        // Create a content item
        var contentPayload = new { title = "Duplicate Test" };
        var contentJson = JsonSerializer.Serialize(contentPayload);
        var contentRequest = new StringContent(contentJson, Encoding.UTF8, "application/json");

        await client.PutAsync($"/api/v1/{factory.TestTenant}/dup-doc.json", contentRequest);

        // Get directory ID
        string? directoryId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CmsLiteDbContext>();
            var contentItem = await db.ContentItemsTable.FirstOrDefaultAsync(ci => ci.Resource == "dup-doc.json");
            directoryId = contentItem!.DirectoryId;
        }

        // Add to favorites first time
        var addFavoriteRequest = new AddFavoriteRequest
        {
            UserId = factory.TestUser,
            ContentId = $"{directoryId}:dup-doc.json"
        };

        var firstResponse = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addFavoriteRequest);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        // Act - Try to add the same favorite again
        var secondResponse = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addFavoriteRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
    }

    [Fact]
    public async Task AddFavorite_NonExistentContentItem_ReturnsBadRequest()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        var addFavoriteRequest = new AddFavoriteRequest
        {
            UserId = factory.TestUser,
            ContentId = "nonexistent-dir:nonexistent-file.json"
        };

        // Act
        var response = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addFavoriteRequest);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errorMessage = await response.Content.ReadAsStringAsync();
        Assert.Contains("Content item does not exist", errorMessage);
    }

    [Fact]
    public async Task AddFavorite_InvalidContentIdFormat_ReturnsBadRequest()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        var addFavoriteRequest = new AddFavoriteRequest
        {
            UserId = factory.TestUser,
            ContentId = "invalid-format-no-colon"
        };

        // Act
        var response = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addFavoriteRequest);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddFavorite_WithoutAuthentication_ReturnsUnauthorized()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateClient(); // Unauthenticated client

        var addFavoriteRequest = new AddFavoriteRequest
        {
            UserId = "some-user",
            ContentId = "dir:file.json"
        };

        // Act
        var response = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addFavoriteRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AddFavorite_UserIdMismatch_ReturnsUnauthorized()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        var addFavoriteRequest = new AddFavoriteRequest
        {
            UserId = "different-user-id", // Different from authenticated user
            ContentId = "dir:file.json"
        };

        // Act
        var response = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addFavoriteRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetFavorites_ReturnsUserFavorites()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        // Create multiple content items
        var contentItems = new[] { "fav1.json", "fav2.json", "fav3.json" };
        var directoryIds = new List<string>();

        foreach (var resource in contentItems)
        {
            var payload = new { title = $"Content {resource}" };
            var json = JsonSerializer.Serialize(payload);
            var request = new StringContent(json, Encoding.UTF8, "application/json");
            await client.PutAsync($"/api/v1/{factory.TestTenant}/{resource}", request);

            // Get directory ID
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CmsLiteDbContext>();
            var item = await db.ContentItemsTable.FirstOrDefaultAsync(ci => ci.Resource == resource);
            directoryIds.Add(item!.DirectoryId);
        }

        // Add first two to favorites
        for (int i = 0; i < 2; i++)
        {
            var addRequest = new AddFavoriteRequest
            {
                UserId = factory.TestUser,
                ContentId = $"{directoryIds[i]}:{contentItems[i]}"
            };
            await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addRequest);
        }

        // Act
        var response = await client.GetAsync($"/api/v1/{factory.TestTenant}/favorites");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var favorites = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.NotNull(favorites);
        Assert.Equal(2, favorites.Count);

        var resourceNames = favorites.Select(f => f.GetProperty("resource").GetString()).ToList();
        Assert.Contains("fav1.json", resourceNames);
        Assert.Contains("fav2.json", resourceNames);
        Assert.DoesNotContain("fav3.json", resourceNames);
    }

    [Fact]
    public async Task GetFavorites_NoFavorites_ReturnsEmptyList()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        // Act
        var response = await client.GetAsync($"/api/v1/{factory.TestTenant}/favorites");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var favorites = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.NotNull(favorites);
        Assert.Empty(favorites);
    }

    [Fact]
    public async Task GetFavorites_WithoutAuthentication_ReturnsUnauthorized()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateClient(); // Unauthenticated

        // Act
        var response = await client.GetAsync($"/api/v1/{factory.TestTenant}/favorites");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteFavorite_ExistingFavorite_ReturnsNoContent()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        // Create content and add to favorites
        var payload = new { title = "To Delete" };
        var json = JsonSerializer.Serialize(payload);
        var request = new StringContent(json, Encoding.UTF8, "application/json");
        await client.PutAsync($"/api/v1/{factory.TestTenant}/delete-fav.json", request);

        int contentItemId;
        string? directoryId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CmsLiteDbContext>();
            var item = await db.ContentItemsTable.FirstOrDefaultAsync(ci => ci.Resource == "delete-fav.json");
            contentItemId = item!.Id;
            directoryId = item.DirectoryId;
        }

        var addRequest = new AddFavoriteRequest
        {
            UserId = factory.TestUser,
            ContentId = $"{directoryId}:delete-fav.json"
        };
        await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addRequest);

        // Act - Use directoryId:resourceName format for DELETE
        var response = await client.DeleteAsync($"/api/v1/{factory.TestTenant}/favorites/{directoryId}:delete-fav.json");

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Verify it's removed from database
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CmsLiteDbContext>();
            var favorite = await db.FavoritesTable.FirstOrDefaultAsync(f => f.ContentItemId == contentItemId);
            Assert.Null(favorite);
        }
    }

    [Fact]
    public async Task DeleteFavorite_NonExistentFavorite_ReturnsNotFound()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        // Act - Try to delete a favorite that doesn't exist
        var response = await client.DeleteAsync($"/api/v1/{factory.TestTenant}/favorites/99999");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteFavorite_WithoutAuthentication_ReturnsUnauthorized()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateClient(); // Unauthenticated

        // Act
        var response = await client.DeleteAsync($"/api/v1/{factory.TestTenant}/favorites/1");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Favorites_CompleteWorkflow_CreateRetrieveDelete()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        // Step 1: Create content items
        var resources = new[] { "workflow1.json", "workflow2.json"};
        var contentItemIds = new List<int>();
        var directoryIds = new List<string>();

        foreach (var resource in resources)
        {
            var payload = new { title = $"Workflow {resource}" };
            var json = JsonSerializer.Serialize(payload);
            var request = new StringContent(json, Encoding.UTF8, "application/json");
            await client.PutAsync($"/api/v1/{factory.TestTenant}/{resource}", request);

            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CmsLiteDbContext>();
            var item = await db.ContentItemsTable.FirstOrDefaultAsync(ci => ci.Resource == resource);
            contentItemIds.Add(item!.Id);
            directoryIds.Add(item.DirectoryId);
        }

        // Step 2: Add all to favorites
        foreach (var (resource, directoryId) in resources.Zip(directoryIds))
        {
            var addRequest = new AddFavoriteRequest
            {
                UserId = factory.TestUser,
                ContentId = $"{directoryId}:{resource}"
            };
            var addResponse = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addRequest);
            Assert.Equal(HttpStatusCode.Created, addResponse.StatusCode);
        }

        // Step 3: Retrieve all favorites
        var getResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}/favorites");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var favorites = await getResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.Equal(2, favorites!.Count);

        // Step 4: Delete one favorite - Use directoryId:resourceName format
        var deleteResponse = await client.DeleteAsync($"/api/v1/{factory.TestTenant}/favorites/{directoryIds[1]}:{resources[1]}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // Step 5: Verify only 1 favorite remains
        var getFinalResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}/favorites");
        var finalFavorites = await getFinalResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.Single(finalFavorites!);

        var finalResourceNames = finalFavorites!.Select(f => f.GetProperty("resource").GetString() ?? string.Empty).ToList();
        Assert.Contains("workflow1.json", finalResourceNames);
        Assert.DoesNotContain("workflow2.json", finalResourceNames);
    }

    [Fact]
    public async Task AddFavorite_CaseInsensitiveResourceName_Works()
    {
        // Arrange
        using var factory = new CmsLiteTestFactoryAuth();
        await factory.InitializeAsync();
        var client = factory.CreateAuthenticatedClient();

        // Create content with specific casing
        var payload = new { title = "Case Test" };
        var json = JsonSerializer.Serialize(payload);
        var request = new StringContent(json, Encoding.UTF8, "application/json");
        await client.PutAsync($"/api/v1/{factory.TestTenant}/CaseTest.json", request);

        string? directoryId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CmsLiteDbContext>();
            var item = await db.ContentItemsTable.FirstOrDefaultAsync(ci => ci.Resource == "CaseTest.json".ToLowerInvariant());
            directoryId = item!.DirectoryId;
        }

        // Try to add favorite with different casing (based on FavoriteRepo implementation using InvariantCultureIgnoreCase)
        var addRequest = new AddFavoriteRequest
        {
            UserId = factory.TestUser,
            ContentId = $"{directoryId}:casetest.json" // lowercase
        };

        // Act
        var response = await client.PostAsJsonAsync($"/api/v1/{factory.TestTenant}/favorites", addRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    #endregion

    private static StringContent CreateJsonContent(object obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return new StringContent(json, Encoding.UTF8, "application/json");
    }
}