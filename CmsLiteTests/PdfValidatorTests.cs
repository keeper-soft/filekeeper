using System.Text;
using System.Text.RegularExpressions;
using CmsLite.Helpers;
using PdfSharp.Pdf;

namespace CmsLiteTests;

public class PdfValidatorTests
{
    private static readonly PdfValidationOptions DefaultOptions = new()
    {
        MaxFileSizeBytes = 8 * 1024 * 1024,
        MaxPageCount = 1000,
        AllowPasswordProtected = false,
        AllowCrossReferenceStreams = true,
        ScanForEmbeddedFiles = true,
        ScanForJavaScript = true,
        ScanForInvalidImages = true
    };

    [Fact]
    public void ValidatePdf_ValidMinimalPdf_Succeeds()
    {
        var result = PdfValidator.ValidatePdf(CreateValidPdf(), DefaultOptions);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void ValidatePdf_ValidPdfWithImage_Succeeds()
    {
        var result = PdfValidator.ValidatePdf(CreateValidPdfWithImage(), DefaultOptions);

        Assert.True(result.IsValid, result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_NonPdfBytes_Fails()
    {
        var result = PdfValidator.ValidatePdf(Encoding.UTF8.GetBytes("not a pdf"), DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Invalid PDF header", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_MissingVersion_Fails()
    {
        var invalidPdf = Encoding.ASCII.GetBytes("%PDF-\n1 0 obj\n<<>>\nendobj\nstartxref\n0\n%%EOF");

        var result = PdfValidator.ValidatePdf(invalidPdf, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Expected '%PDF-x.y'", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_UnsupportedVersion_Fails()
    {
        var headerRegex = new Regex(@"%PDF-\d\.\d");
        var unsupportedVersionPdf = Encoding.Latin1.GetBytes(
            headerRegex.Replace(Encoding.Latin1.GetString(CreateValidPdf()), "%PDF-9.9", 1));

        var result = PdfValidator.ValidatePdf(unsupportedVersionPdf, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Unsupported PDF version", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_MissingEof_Fails()
    {
        var missingEofPdf = RemoveLastMarker(CreateValidPdf(), "%%EOF");

        var result = PdfValidator.ValidatePdf(missingEofPdf, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Missing %%EOF", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_ContentAfterEof_Fails()
    {
        var withTrailingContent = Encoding.ASCII.GetBytes(Encoding.Latin1.GetString(CreateValidPdf()) + "JUNK");

        var result = PdfValidator.ValidatePdf(withTrailingContent, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Only whitespace is allowed after %%EOF", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_MissingStartxref_Fails()
    {
        var missingStartXrefPdf = ReplaceAscii(CreateValidPdf(), "startxref", "startxrf ");

        var result = PdfValidator.ValidatePdf(missingStartXrefPdf, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Missing startxref", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_InvalidStartxrefOffset_Fails()
    {
        var invalidStartXrefPdf = Regex.Replace(
            Encoding.Latin1.GetString(CreateValidPdf()),
            @"startxref\s+\d+",
            "startxref\n999999",
            RegexOptions.RightToLeft);

        var result = PdfValidator.ValidatePdf(Encoding.ASCII.GetBytes(invalidStartXrefPdf), DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("outside the file", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_MissingClassicXref_Fails()
    {
        var xrefRegex = new Regex(@"(?m)^xref\s*$");
        var missingXrefPdf = Encoding.Latin1.GetBytes(
            xrefRegex.Replace(Encoding.Latin1.GetString(CreateValidPdf()), "xrf ", 1));

        var result = PdfValidator.ValidatePdf(missingXrefPdf, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Missing cross-reference", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_MissingTrailer_Fails()
    {
        var missingTrailerPdf = ReplaceAscii(CreateValidPdf(), "trailer", "trailrx");

        var result = PdfValidator.ValidatePdf(missingTrailerPdf, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Missing trailer dictionary", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_XrefStreamPdf_Succeeds()
    {
        var result = PdfValidator.ValidatePdf(CreateXrefStreamPdf(), DefaultOptions);

        Assert.True(result.IsValid, result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_XrefStreamPdfFailsWhenDisabled()
    {
        var options = new PdfValidationOptions
        {
            MaxFileSizeBytes = DefaultOptions.MaxFileSizeBytes,
            MaxPageCount = DefaultOptions.MaxPageCount,
            AllowPasswordProtected = DefaultOptions.AllowPasswordProtected,
            AllowCrossReferenceStreams = false,
            ScanForEmbeddedFiles = DefaultOptions.ScanForEmbeddedFiles,
            ScanForJavaScript = DefaultOptions.ScanForJavaScript,
            ScanForInvalidImages = DefaultOptions.ScanForInvalidImages
        };

        var result = PdfValidator.ValidatePdf(CreateXrefStreamPdf(), options);

        Assert.False(result.IsValid);
        Assert.Contains("cross-reference streams", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_BrokenObjectStructure_Fails()
    {
        var brokenObjectPdf = ReplaceAscii(CreateValidPdf(), "endobj", "endobx");

        var result = PdfValidator.ValidatePdf(brokenObjectPdf, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Broken object boundaries", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_InvalidImageMetadata_Fails()
    {
        var malformedImagePdf = ReplaceAscii(CreateValidPdfWithImage(), "/Width 1", "/Width 0");

        var result = PdfValidator.ValidatePdf(malformedImagePdf, DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("Image dimensions must be positive", result.ErrorMessage);
    }

    [Fact]
    public void ValidatePdf_EmbeddedFiles_FailExistingSecurityCheck()
    {
        var result = PdfValidator.ValidatePdf(CreatePdfWithEmbeddedFile(), DefaultOptions);

        Assert.False(result.IsValid);
        Assert.Contains("embedded files", result.ErrorMessage, StringComparison.OrdinalIgnoreCase);
    }

    private static byte[] CreateValidPdf(string title = "Validator test")
    {
        using var document = new PdfDocument();
        document.Info.Title = title;
        document.AddPage();

        using var stream = new MemoryStream();
        document.Save(stream, false);
        return stream.ToArray();
    }

    private static byte[] CreateValidPdfWithImage()
    {
        return CreateClassicPdfWithImage(1, 1, [0xFF, 0x00, 0x00]);
    }

    private static byte[] CreatePdfWithEmbeddedFile()
    {
        using var document = new PdfDocument();
        document.AddPage();
        using var fileStream = new MemoryStream(Encoding.UTF8.GetBytes("payload"));
        document.AddEmbeddedFile("payload.txt", fileStream);

        using var output = new MemoryStream();
        document.Save(output, false);
        return output.ToArray();
    }

    private static byte[] ReplaceAscii(byte[] source, string oldValue, string newValue)
    {
        var content = Encoding.Latin1.GetString(source);
        var index = content.IndexOf(oldValue, StringComparison.Ordinal);
        Assert.True(index >= 0, $"Expected to find '{oldValue}' in PDF content.");
        return Encoding.Latin1.GetBytes(content.Remove(index, oldValue.Length).Insert(index, newValue));
    }

    private static byte[] RemoveLastMarker(byte[] source, string marker)
    {
        var content = Encoding.Latin1.GetString(source);
        var index = content.LastIndexOf(marker, StringComparison.Ordinal);
        Assert.True(index >= 0, $"Expected to find '{marker}' in PDF content.");
        return Encoding.Latin1.GetBytes(content.Remove(index, marker.Length));
    }

    private static byte[] CreateXrefStreamPdf()
    {
        var object1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
        var object2 = "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n";
        var object3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] >>\nendobj\n";
        var header = "%PDF-1.5\n";

        var object4Prefix = "4 0 obj\n<< /Type /XRef /Size 5 /Root 1 0 R /W [1 4 2] /Length 35 >>\nstream\n";
        var object4Suffix = "\nendstream\nendobj\n";

        var offset1 = Encoding.ASCII.GetByteCount(header);
        var offset2 = offset1 + Encoding.ASCII.GetByteCount(object1);
        var offset3 = offset2 + Encoding.ASCII.GetByteCount(object2);
        var offset4 = offset3 + Encoding.ASCII.GetByteCount(object3);

        byte[] xrefStreamBytes =
        [
            0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF,
            0x01, (byte)(offset1 >> 24), (byte)(offset1 >> 16), (byte)(offset1 >> 8), (byte)offset1, 0x00, 0x00,
            0x01, (byte)(offset2 >> 24), (byte)(offset2 >> 16), (byte)(offset2 >> 8), (byte)offset2, 0x00, 0x00,
            0x01, (byte)(offset3 >> 24), (byte)(offset3 >> 16), (byte)(offset3 >> 8), (byte)offset3, 0x00, 0x00,
            0x01, (byte)(offset4 >> 24), (byte)(offset4 >> 16), (byte)(offset4 >> 8), (byte)offset4, 0x00, 0x00
        ];

        using var output = new MemoryStream();
        output.Write(Encoding.ASCII.GetBytes(header));
        output.Write(Encoding.ASCII.GetBytes(object1));
        output.Write(Encoding.ASCII.GetBytes(object2));
        output.Write(Encoding.ASCII.GetBytes(object3));
        output.Write(Encoding.ASCII.GetBytes(object4Prefix));
        output.Write(xrefStreamBytes);
        output.Write(Encoding.ASCII.GetBytes(object4Suffix));
        output.Write(Encoding.ASCII.GetBytes($"startxref\n{offset4}\n%%EOF"));
        return output.ToArray();
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
