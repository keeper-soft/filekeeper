using System.Net;
using System.Text;
using CmsLiteTests.Support;
using Xunit;

namespace CmsLiteTests;

public class ContentApiCsvTests : IAsyncDisposable
{
    private readonly CmsLiteTestFactoryAuth factory = new();

    public async ValueTask DisposeAsync() => await factory.DisposeAsync();

    private static byte[] CreateValidCsv(string content = "name,age,city\nAlice,30,London\nBob,25,Paris")
    {
        return Encoding.UTF8.GetBytes(content);
    }

    [Fact]
    public async Task UploadCsv_ValidCsv_ReturnsCreated()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv();
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/test-data.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("test-data.csv", content);
        Assert.Contains("version", content);
    }

    [Fact]
    public async Task UploadCsv_EmptyBody_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var emptyContent = new ByteArrayContent(Array.Empty<byte>());
        emptyContent.Headers.ContentType = new("text/csv");

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/empty.csv", emptyContent);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Empty body", content);
    }

    [Fact]
    public async Task UploadCsv_MissingContentType_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv();
        var content = new ByteArrayContent(csvBytes);
        content.Headers.ContentType = null;

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/no-content-type.csv", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var responseContent = await response.Content.ReadAsStringAsync();
        Assert.Contains("Content-Type header is required", responseContent);
    }

    [Fact]
    public async Task GetCsv_ExistingCsv_ReturnsCsvContent()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv("id,value\n1,hello\n2,world");
        await client.PutAsync($"/api/v1/{factory.TestTenant}/retrieve-test.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        var response = await client.GetAsync($"/api/v1/{factory.TestTenant}/retrieve-test.csv");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);

        var retrievedBytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(csvBytes, retrievedBytes);
    }

    [Fact]
    public async Task GetCsv_NonExistentCsv_ReturnsNotFound()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var response = await client.GetAsync($"/api/v1/{factory.TestTenant}/nonexistent.csv");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task HeadCsv_ExistingCsv_ReturnsMetadata()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv("col1,col2\nval1,val2");
        await client.PutAsync($"/api/v1/{factory.TestTenant}/head-test.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        var request = new HttpRequestMessage(HttpMethod.Head, $"/api/v1/{factory.TestTenant}/head-test.csv");
        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var contentType = response.Content.Headers.ContentType?.MediaType ??
                         response.Headers.GetValues("Content-Type").FirstOrDefault();
        Assert.Equal("text/csv", contentType);

        Assert.True(response.Content.Headers.ContentLength > 0);

        var hasETag = response.Headers.ETag != null || response.Headers.Contains("ETag");
        Assert.True(hasETag, "Response should contain ETag header");
    }

    [Fact]
    public async Task UploadCsv_MultipleVersions_CreatesVersionHistory()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvV1 = CreateValidCsv("name,score\nAlice,90");
        var response1 = await client.PutAsync($"/api/v1/{factory.TestTenant}/versioned.csv",
            new ByteArrayContent(csvV1) { Headers = { ContentType = new("text/csv") } });
        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);

        var csvV2 = CreateValidCsv("name,score\nAlice,90\nBob,85");
        var response2 = await client.PutAsync($"/api/v1/{factory.TestTenant}/versioned.csv",
            new ByteArrayContent(csvV2) { Headers = { ContentType = new("text/csv") } });
        Assert.True(response2.StatusCode == HttpStatusCode.OK || response2.StatusCode == HttpStatusCode.Created);

        var getResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}/versioned.csv");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var retrievedBytes = await getResponse.Content.ReadAsByteArrayAsync();
        Assert.Equal(csvV2, retrievedBytes);

        var getV1Response = await client.GetAsync($"/api/v1/{factory.TestTenant}/versioned.csv?version=1");
        Assert.Equal(HttpStatusCode.OK, getV1Response.StatusCode);
        var retrievedV1Bytes = await getV1Response.Content.ReadAsByteArrayAsync();
        Assert.Equal(csvV1, retrievedV1Bytes);
    }

    [Fact]
    public async Task DeleteCsv_ExistingCsv_ReturnsSoftDeleted()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv();
        await client.PutAsync($"/api/v1/{factory.TestTenant}/to-delete.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        var deleteResponse = await client.DeleteAsync($"/api/v1/{factory.TestTenant}/to-delete.csv");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}/to-delete.csv");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task ListResources_IncludesCsvFiles()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv();
        await client.PutAsync($"/api/v1/{factory.TestTenant}/list-test.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        var listResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var content = await listResponse.Content.ReadAsStringAsync();
        Assert.Contains("list-test.csv", content);
    }

    [Fact]
    public async Task UploadCsv_WithoutAuthentication_ReturnsUnauthorized()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();

        var csvBytes = CreateValidCsv();
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/unauthorized.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UploadCsv_SemicolonDelimiter_ReturnsCreated()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv("name;age;city\nAlice;30;London\nBob;25;Paris");
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/semicolon-data.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
