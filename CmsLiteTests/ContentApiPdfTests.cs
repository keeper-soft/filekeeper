using System.Net;
using System.Text;
using CmsLiteTests.Support;
using PdfSharp.Pdf;
using Xunit;

namespace CmsLiteTests;

public class ContentApiPdfTests : IAsyncDisposable
{
    private readonly CmsLiteTestFactoryAuth factory = new();

    public async ValueTask DisposeAsync() => await factory.DisposeAsync();

    // Helper method to create a valid PDF file using PdfSharp
    private static byte[] CreateValidPdf(string content = "Test PDF content")
    {
        using var document = new PdfDocument();
        document.Info.Title = content; // Store content in metadata instead

        // Add a blank page - this creates a valid, parseable PDF structure
        document.AddPage();

        using var ms = new MemoryStream();
        document.Save(ms, false);
        return ms.ToArray();
    }

    private static byte[] CreateValidPdfWithImage()
    {
        return CreateClassicPdfWithImage(1, 1, [0xFF, 0x00, 0x00]);
    }

    [Fact]
    public async Task UploadPdf_ValidPdf_ReturnsCreated()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var pdfBytes = CreateValidPdf("This is a test PDF document.");
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/test-document.pdf",
            new ByteArrayContent(pdfBytes) { Headers = { ContentType = new("application/pdf") } });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("test-document.pdf", content);
        Assert.Contains("version", content);
    }

    [Fact]
    public async Task UploadPdf_InvalidPdfBytes_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Create invalid PDF (doesn't start with %PDF-)
        var invalidPdfBytes = Encoding.UTF8.GetBytes("This is not a PDF file");
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/invalid-document.pdf",
            new ByteArrayContent(invalidPdfBytes) { Headers = { ContentType = new("application/pdf") } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Invalid PDF header", content);
    }

    [Fact]
    public async Task UploadPdf_MissingContentType_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var pdfBytes = CreateValidPdf();
        var content = new ByteArrayContent(pdfBytes);
        content.Headers.ContentType = null; // No Content-Type header

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/no-content-type.pdf", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var responseContent = await response.Content.ReadAsStringAsync();
        Assert.Contains("Content-Type header is required", responseContent);
    }

    [Fact]
    public async Task GetPdf_ExistingPdf_ReturnsPdfContent()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Upload PDF first
        var pdfBytes = CreateValidPdf("Retrieve me!");
        await client.PutAsync($"/api/v1/{factory.TestTenant}/retrieve-test.pdf",
            new ByteArrayContent(pdfBytes) { Headers = { ContentType = new("application/pdf") } });

        // Retrieve PDF
        var response = await client.GetAsync($"/api/v1/{factory.TestTenant}/retrieve-test.pdf");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);

        var retrievedBytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(pdfBytes, retrievedBytes);
    }

    [Fact]
    public async Task GetPdf_NonExistentPdf_ReturnsNotFound()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var response = await client.GetAsync($"/api/v1/{factory.TestTenant}/nonexistent.pdf");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task HeadPdf_ExistingPdf_ReturnsMetadata()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Upload PDF first
        var pdfBytes = CreateValidPdf("Metadata test");
        await client.PutAsync($"/api/v1/{factory.TestTenant}/metadata-test.pdf",
            new ByteArrayContent(pdfBytes) { Headers = { ContentType = new("application/pdf") } });

        // Get metadata with HEAD
        var request = new HttpRequestMessage(HttpMethod.Head, $"/api/v1/{factory.TestTenant}/metadata-test.pdf");
        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Content-Type can be in response.Content.Headers or response.Headers
        var contentType = response.Content.Headers.ContentType?.MediaType ??
                         response.Headers.GetValues("Content-Type").FirstOrDefault();
        Assert.Equal("application/pdf", contentType);

        Assert.True(response.Content.Headers.ContentLength > 0);

        // ETag can be in response.Headers.ETag or response.Headers["ETag"]
        var hasETag = response.Headers.ETag != null || response.Headers.Contains("ETag");
        Assert.True(hasETag, "Response should contain ETag header");
    }

    [Fact]
    public async Task UploadPdf_MultipleVersions_CreatesVersionHistory()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Upload version 1
        var pdfV1 = CreateValidPdf("Version 1 content");
        var response1 = await client.PutAsync($"/api/v1/{factory.TestTenant}/versioned.pdf",
            new ByteArrayContent(pdfV1) { Headers = { ContentType = new("application/pdf") } });
        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);

        // Upload version 2
        var pdfV2 = CreateValidPdf("Version 2 content - updated");
        var response2 = await client.PutAsync($"/api/v1/{factory.TestTenant}/versioned.pdf",
            new ByteArrayContent(pdfV2) { Headers = { ContentType = new("application/pdf") } });
        Assert.True(response2.StatusCode == HttpStatusCode.OK || response2.StatusCode == HttpStatusCode.Created);

        // Get latest version (should be version 2)
        var getResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}/versioned.pdf");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var retrievedBytes = await getResponse.Content.ReadAsByteArrayAsync();
        Assert.Equal(pdfV2, retrievedBytes);

        // Get version 1 explicitly
        var getV1Response = await client.GetAsync($"/api/v1/{factory.TestTenant}/versioned.pdf?version=1");
        Assert.Equal(HttpStatusCode.OK, getV1Response.StatusCode);
        var retrievedV1Bytes = await getV1Response.Content.ReadAsByteArrayAsync();
        Assert.Equal(pdfV1, retrievedV1Bytes);
    }

    [Fact]
    public async Task DeletePdf_ExistingPdf_ReturnsSoftDeleted()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Upload PDF
        var pdfBytes = CreateValidPdf("Delete me");
        await client.PutAsync($"/api/v1/{factory.TestTenant}/to-delete.pdf",
            new ByteArrayContent(pdfBytes) { Headers = { ContentType = new("application/pdf") } });

        // Delete PDF (soft delete)
        var deleteResponse = await client.DeleteAsync($"/api/v1/{factory.TestTenant}/to-delete.pdf");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // Try to retrieve deleted PDF
        var getResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}/to-delete.pdf");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task ListResources_IncludesPdfFiles()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Upload a PDF
        var pdfBytes = CreateValidPdf("List test");
        await client.PutAsync($"/api/v1/{factory.TestTenant}/list-test.pdf",
            new ByteArrayContent(pdfBytes) { Headers = { ContentType = new("application/pdf") } });

        // List resources
        var listResponse = await client.GetAsync($"/api/v1/{factory.TestTenant}");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var content = await listResponse.Content.ReadAsStringAsync();
        Assert.Contains("list-test.pdf", content);
    }

    [Fact]
    public async Task UploadPdf_EmptyBody_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var emptyContent = new ByteArrayContent(Array.Empty<byte>());
        emptyContent.Headers.ContentType = new("application/pdf");

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/empty.pdf", emptyContent);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Empty body", content);
    }

    [Fact]
    public async Task UploadPdf_WithoutAuthentication_ReturnsUnauthorized()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        // No authentication token

        var pdfBytes = CreateValidPdf();
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/unauthorized.pdf",
            new ByteArrayContent(pdfBytes) { Headers = { ContentType = new("application/pdf") } });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UploadPdf_CorruptedPdf_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Create corrupted PDF with valid header but invalid structure
        var corruptedPdf = Encoding.UTF8.GetBytes("%PDF-1.4\nCorrupted content without proper PDF structure");
        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/corrupted.pdf",
            new ByteArrayContent(corruptedPdf) { Headers = { ContentType = new("application/pdf") } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.True(
            content.Contains("PDF validation failed", StringComparison.OrdinalIgnoreCase) ||
            content.Contains("Invalid PDF structure", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task UploadPdf_ExceedsMaxFileSize_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Create a large byte array that exceeds 8 MB limit (8388608 bytes)
        var largePdfContent = new byte[8388609]; // 8 MB + 1 byte
        Array.Copy(Encoding.UTF8.GetBytes("%PDF-1.4"), largePdfContent, 8);

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/large.pdf",
            new ByteArrayContent(largePdfContent) { Headers = { ContentType = new("application/pdf") } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("exceeds maximum allowed size", content);
    }

    [Fact]
    public async Task UploadPdf_PdfWithNoPages_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Create minimal PDF structure with no pages
        var noPagesContent = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f\n0000000009 00000 n\ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n50\n%%EOF\n";
        var noPagesBytes = Encoding.UTF8.GetBytes(noPagesContent);

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/no-pages.pdf",
            new ByteArrayContent(noPagesBytes) { Headers = { ContentType = new("application/pdf") } });

        // This should fail validation - either "no pages" or structure error
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.True(
            content.Contains("no pages", StringComparison.OrdinalIgnoreCase) ||
            content.Contains("Invalid or corrupted PDF structure", StringComparison.OrdinalIgnoreCase) ||
            content.Contains("Invalid PDF structure", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task UploadPdf_ValidMinimalPdf_Success()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        // Use the helper method to create a valid minimal PDF
        var validPdf = CreateValidPdf("Minimal test content");

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/minimal-valid.pdf",
            new ByteArrayContent(validPdf) { Headers = { ContentType = new("application/pdf") } });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task UploadPdf_WithEmbeddedImage_ReturnsCreated()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var pdfBytes = CreateValidPdfWithImage();

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/image.pdf",
            new ByteArrayContent(pdfBytes) { Headers = { ContentType = new("application/pdf") } });

        if (response.StatusCode != HttpStatusCode.Created)
        {
            var error = await response.Content.ReadAsStringAsync();
            Assert.Fail(error);
        }

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task UploadPdf_WithMalformedImageMetadata_ReturnsBadRequest()
    {
        await factory.InitializeAsync();
        var client = factory.CreateClient();
        var token = factory.GenerateTestJwtToken();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        var malformedPdf = Encoding.Latin1.GetBytes(
            Encoding.Latin1.GetString(CreateValidPdfWithImage()).Replace("/Width 1", "/Width 0", StringComparison.Ordinal));

        var response = await client.PutAsync($"/api/v1/{factory.TestTenant}/invalid-image.pdf",
            new ByteArrayContent(malformedPdf) { Headers = { ContentType = new("application/pdf") } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("image structure", content, StringComparison.OrdinalIgnoreCase);
    }

    private static byte[] CreateClassicPdfWithImage(int width, int height, byte[] rgbBytes)
    {
        var objects = new List<byte[]>();
        objects.Add(Encoding.ASCII.GetBytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
        objects.Add(Encoding.ASCII.GetBytes("2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n"));
        objects.Add(Encoding.ASCII.GetBytes("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"));

        var imagePrefix = Encoding.ASCII.GetBytes(
            $"4 0 obj\n<< /Type /XObject /Subtype /Image /Width {width} /Height {height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length {rgbBytes.Length} >>\nstream\n");
        var imageSuffix = Encoding.ASCII.GetBytes("\nendstream\nendobj\n");
        using (var imageObject = new MemoryStream())
        {
            imageObject.Write(imagePrefix);
            imageObject.Write(rgbBytes);
            imageObject.Write(imageSuffix);
            objects.Add(imageObject.ToArray());
        }

        var contentBytes = Encoding.ASCII.GetBytes("q\n10 0 0 10 10 10 cm\n/Im0 Do\nQ\n");
        var contentObject = Encoding.ASCII.GetBytes($"5 0 obj\n<< /Length {contentBytes.Length} >>\nstream\n{Encoding.ASCII.GetString(contentBytes)}endstream\nendobj\n");
        objects.Add(contentObject);

        var header = Encoding.ASCII.GetBytes("%PDF-1.4\n");
        var offsets = new List<int> { 0 };
        var position = header.Length;
        foreach (var pdfObject in objects)
        {
            offsets.Add(position);
            position += pdfObject.Length;
        }

        using var output = new MemoryStream();
        output.Write(header);
        foreach (var pdfObject in objects)
        {
            output.Write(pdfObject);
        }

        var xrefOffset = (int)output.Position;
        output.Write(Encoding.ASCII.GetBytes($"xref\n0 {objects.Count + 1}\n"));
        output.Write(Encoding.ASCII.GetBytes("0000000000 65535 f \n"));
        foreach (var offset in offsets.Skip(1))
        {
            output.Write(Encoding.ASCII.GetBytes($"{offset:D10} 00000 n \n"));
        }

        output.Write(Encoding.ASCII.GetBytes($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF"));
        return output.ToArray();
    }
}
