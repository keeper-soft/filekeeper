using System.Net;
using System.Text;
using CmsLiteTests.Support;
using Xunit;

namespace CmsLiteTests;

public class ContentApiCsvTests : IAsyncDisposable
{
    private readonly CmsLiteTestFactoryAuth factory = new();

    public async ValueTask DisposeAsync() => await factory.DisposeAsync();

    private static byte[] CreateValidCsv(bool hasHeader = true)
    {
        var sb = new StringBuilder();
        if (hasHeader)
            sb.AppendLine("id,name,value");
        sb.AppendLine("1,Alice,100");
        sb.AppendLine("2,Bob,200");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    [Fact]
    public async Task UploadCsv_ValidCsv_ReturnsCreated()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv();
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/data.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("data.csv", content);
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
    public async Task UploadCsv_WithoutAuthentication_ReturnsUnauthorized()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        // No authentication token

        var csvBytes = CreateValidCsv();
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/unauthorized.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetCsv_ExistingCsv_ReturnsCsvContent()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvBytes = CreateValidCsv();
        await client.PutAsync($"/api/v1/{factory.TestTenant}/retrieve-test.csv",
            new ByteArrayContent(csvBytes) { Headers = { ContentType = new("text/csv") } });

        var response = await client.GetAsync($"/api/v1/{factory.TestTenant}/retrieve-test.csv");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);

        var retrieved = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(csvBytes, retrieved);
    }

    [Fact]
    public async Task UploadCsv_MultipleVersions_CreatesVersionHistory()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var csvV1 = Encoding.UTF8.GetBytes("id,name\n1,Alice");
        var response1 = await client.PutAsync($"/api/v1/{factory.TestTenant}/versioned.csv",
            new ByteArrayContent(csvV1) { Headers = { ContentType = new("text/csv") } });
        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);

        var csvV2 = Encoding.UTF8.GetBytes("id,name\n1,Alice\n2,Bob");
        var response2 = await client.PutAsync($"/api/v1/{factory.TestTenant}/versioned.csv",
            new ByteArrayContent(csvV2) { Headers = { ContentType = new("text/csv") } });
        Assert.True(response2.StatusCode == HttpStatusCode.OK || response2.StatusCode == HttpStatusCode.Created);

        var getResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}/versioned.csv");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var retrieved = await getResponse.Content.ReadAsByteArrayAsync();
        Assert.Equal(csvV2, retrieved);
    }
}
