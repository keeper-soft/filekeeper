using System.Text;
using System.Text.RegularExpressions;
using PdfSharp.Pdf;
using PdfSharp.Pdf.Advanced;
using PdfSharp.Pdf.IO;

namespace CmsLite.Helpers;

/// <summary>
/// Configuration options for PDF validation.
/// </summary>
public class PdfValidationOptions
{
    /// <summary>
    /// Maximum allowed file size in bytes. Default: 8 MB (8388608 bytes).
    /// </summary>
    public int MaxFileSizeBytes { get; set; } = 8388608;

    /// <summary>
    /// Maximum allowed number of pages. Default: 1000.
    /// </summary>
    public int MaxPageCount { get; set; } = 1000;

    /// <summary>
    /// Whether to allow password-protected PDFs. Default: false.
    /// </summary>
    public bool AllowPasswordProtected { get; set; } = false;

    /// <summary>
    /// Whether to scan for embedded files/attachments. Default: true.
    /// </summary>
    public bool ScanForEmbeddedFiles { get; set; } = true;

    /// <summary>
    /// Whether to scan for JavaScript. Default: true.
    /// </summary>
    public bool ScanForJavaScript { get; set; } = true;

    /// <summary>
    /// Whether to allow PDFs that use cross-reference streams instead of classic xref/trailer sections.
    /// Default: true.
    /// </summary>
    public bool AllowCrossReferenceStreams { get; set; } = true;

    /// <summary>
    /// Whether to validate embedded image XObjects for structural integrity. Default: true.
    /// </summary>
    public bool ScanForInvalidImages { get; set; } = true;
}

/// <summary>
/// Result of PDF validation.
/// </summary>
public class PdfValidationResult
{
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }
    public PdfValidationWarning[]? Warnings { get; set; }

    public static PdfValidationResult Success() => new() { IsValid = true };
    public static PdfValidationResult Failure(string errorMessage) => new() { IsValid = false, ErrorMessage = errorMessage };
}

/// <summary>
/// Warning information from PDF validation.
/// </summary>
public class PdfValidationWarning
{
    public string Message { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}

/// <summary>
/// Comprehensive PDF validation service using PdfSharp 6.x.
/// </summary>
public static class PdfValidator
{
    private static readonly HashSet<string> SupportedPdfVersions =
    [
        "1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "2.0"
    ];

    private static readonly Regex PdfHeaderRegex = new(@"^%PDF-(?<version>\d\.\d)$", RegexOptions.Compiled);
    private static readonly Regex IndirectObjectRegex = new(@"(?m)^[ \t]*\d+[ \t]+\d+[ \t]+obj\b", RegexOptions.Compiled);
    private static readonly Regex EndObjectRegex = new(@"(?m)^[ \t]*endobj\b", RegexOptions.Compiled);
    private static readonly Regex ClassicXrefRegex = new(@"(?m)^[ \t]*xref[ \t]*(?:\r?\n|$)", RegexOptions.Compiled);
    private static readonly Regex TrailerRegex = new(@"(?m)^[ \t]*trailer[ \t]*(?:\r?\n|$)", RegexOptions.Compiled);
    private static readonly Regex XrefStreamRegex = new(@"/Type\s*/XRef\b", RegexOptions.Compiled);

    /// <summary>
    /// Validates a PDF file with comprehensive security and structural checks.
    /// </summary>
    /// <param name="data">PDF file bytes</param>
    /// <param name="options">Validation options</param>
    /// <param name="logger">Optional logger for validation details</param>
    /// <returns>Validation result with success status and error message if applicable</returns>
    public static PdfValidationResult ValidatePdf(byte[] data, PdfValidationOptions options, ILogger? logger = null)
    {
        try
        {
            // 1. Check file size first (before any processing)
            var sizeCheck = CheckFileSize(data, options.MaxFileSizeBytes);
            if (!sizeCheck.IsValid)
            {
                logger?.LogInformation("PDF validation failed: File size exceeds limit ({Size} bytes > {MaxSize} bytes)",
                    data.Length, options.MaxFileSizeBytes);
                return sizeCheck;
            }

            // 2. Strict header/version validation
            var headerCheck = CheckHeaderAndVersion(data, logger);
            if (!headerCheck.IsValid)
            {
                return headerCheck;
            }

            // 3. Raw structural validation before parser-level checks
            var rawStructureCheck = CheckRawStructure(data, options, logger);
            if (!rawStructureCheck.IsValid)
            {
                return rawStructureCheck;
            }

            // 4. Load and parse PDF structure using PdfSharp
            PdfDocument document;
            try
            {
                using var ms = new MemoryStream(data);
                document = PdfReader.Open(ms, PdfDocumentOpenMode.Import);
            }
            catch (PdfReaderException ex)
            {
                logger?.LogWarning(ex, "PDF validation failed: PdfSharp could not parse PDF structure");
                return PdfValidationResult.Failure($"Invalid or corrupted PDF structure: {ex.Message}");
            }
            catch (InvalidOperationException ex)
            {
                logger?.LogWarning(ex, "PDF validation failed: Invalid PDF operation");
                return PdfValidationResult.Failure($"Invalid PDF format: {ex.Message}");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Unexpected error during PDF validation");
                return PdfValidationResult.Failure($"PDF validation failed: {ex.Message}");
            }

            // 5. Structural validation
            var structureCheck = CheckStructure(document, options.MaxPageCount, logger);
            if (!structureCheck.IsValid)
            {
                return structureCheck;
            }

            var objectIntegrityCheck = CheckObjectIntegrity(document, logger);
            if (!objectIntegrityCheck.IsValid)
            {
                return objectIntegrityCheck;
            }

            // 6. Embedded image validation
            if (options.ScanForInvalidImages)
            {
                var imageCheck = CheckImageContent(document, logger);
                if (!imageCheck.IsValid)
                {
                    return imageCheck;
                }
            }

            // 7. Security validation (password protection)
            if (!options.AllowPasswordProtected)
            {
                var securityCheck = CheckSecurity(document, logger);
                if (!securityCheck.IsValid)
                {
                    return securityCheck;
                }
            }

            // 8. Malicious content detection
            var maliciousContentCheck = CheckMaliciousContent(document, options, logger);
            if (!maliciousContentCheck.IsValid)
            {
                return maliciousContentCheck;
            }

            logger?.LogInformation("PDF validation succeeded: {PageCount} pages, {Size} bytes",
                document.PageCount, data.Length);
            return PdfValidationResult.Success();
        }
        catch (Exception ex)
        {
            logger?.LogError(ex, "Unexpected error during PDF validation");
            return PdfValidationResult.Failure($"PDF validation failed: {ex.Message}");
        }
    }

    private static PdfValidationResult CheckHeaderAndVersion(byte[] data, ILogger? logger)
    {
        if (!Utilities.IsValidPdf(data))
        {
            logger?.LogInformation("PDF validation failed: Invalid PDF header/magic bytes");
            return PdfValidationResult.Failure("Invalid PDF header. File does not appear to be a valid PDF.");
        }

        var lineEndIndex = Array.FindIndex(data, b => b is (byte)'\n' or (byte)'\r');
        var headerLength = lineEndIndex >= 0 ? lineEndIndex : Math.Min(data.Length, 16);
        var headerLine = Encoding.ASCII.GetString(data, 0, headerLength).TrimEnd('\r', '\n');
        var headerMatch = PdfHeaderRegex.Match(headerLine);

        if (!headerMatch.Success)
        {
            logger?.LogInformation("PDF validation failed: Header line '{HeaderLine}' does not match expected format", headerLine);
            return PdfValidationResult.Failure("Invalid PDF header. Expected '%PDF-x.y' with a supported PDF version.");
        }

        var version = headerMatch.Groups["version"].Value;
        if (!SupportedPdfVersions.Contains(version))
        {
            logger?.LogInformation("PDF validation failed: Unsupported PDF version {Version}", version);
            return PdfValidationResult.Failure($"Unsupported PDF version '{version}'. Supported versions are 1.0 through 1.7 and 2.0.");
        }

        return PdfValidationResult.Success();
    }

    private static PdfValidationResult CheckRawStructure(byte[] data, PdfValidationOptions options, ILogger? logger)
    {
        var pdfText = Encoding.Latin1.GetString(data);

        if (!IndirectObjectRegex.IsMatch(pdfText))
        {
            logger?.LogInformation("PDF validation failed: No indirect object declarations found");
            return PdfValidationResult.Failure("Invalid PDF structure: Missing indirect objects.");
        }

        var objectCount = IndirectObjectRegex.Matches(pdfText).Count;
        var endObjectCount = EndObjectRegex.Matches(pdfText).Count;
        if (endObjectCount < objectCount)
        {
            logger?.LogInformation("PDF validation failed: Mismatched obj/endobj markers ({ObjectCount} objects, {EndObjectCount} endobj)", objectCount, endObjectCount);
            return PdfValidationResult.Failure("Invalid PDF structure: Broken object boundaries.");
        }

        var startXrefIndex = pdfText.LastIndexOf("startxref", StringComparison.Ordinal);
        if (startXrefIndex < 0)
        {
            logger?.LogInformation("PDF validation failed: Missing startxref");
            return PdfValidationResult.Failure("Invalid PDF structure: Missing startxref section.");
        }

        var startXrefValue = ExtractStartXrefValue(pdfText, startXrefIndex);
        if (startXrefValue == null)
        {
            logger?.LogInformation("PDF validation failed: Invalid startxref value");
            return PdfValidationResult.Failure("Invalid PDF structure: startxref must be followed by a numeric offset.");
        }

        if (startXrefValue.Value < 0 || startXrefValue.Value >= data.Length)
        {
            logger?.LogInformation("PDF validation failed: startxref offset {Offset} outside file bounds", startXrefValue.Value);
            return PdfValidationResult.Failure("Invalid PDF structure: startxref points outside the file.");
        }

        var eofIndex = pdfText.LastIndexOf("%%EOF", StringComparison.Ordinal);
        if (eofIndex < 0)
        {
            logger?.LogInformation("PDF validation failed: Missing %%EOF marker");
            return PdfValidationResult.Failure("Invalid PDF structure: Missing %%EOF marker.");
        }

        if (data.Length - eofIndex > 4096)
        {
            logger?.LogInformation("PDF validation failed: %%EOF marker not near file end");
            return PdfValidationResult.Failure("Invalid PDF structure: %%EOF marker must appear near the end of the file.");
        }

        var trailingContent = pdfText[(eofIndex + "%%EOF".Length)..];
        if (trailingContent.Any(c => !char.IsWhiteSpace(c)))
        {
            logger?.LogInformation("PDF validation failed: Non-whitespace found after %%EOF");
            return PdfValidationResult.Failure("Invalid PDF structure: Only whitespace is allowed after %%EOF.");
        }

        var hasClassicXref = ClassicXrefRegex.IsMatch(pdfText);
        var hasTrailer = TrailerRegex.IsMatch(pdfText);
        var hasXrefStream = XrefStreamRegex.IsMatch(pdfText);

        if (hasClassicXref || hasTrailer)
        {
            if (!hasClassicXref)
            {
                logger?.LogInformation("PDF validation failed: Missing classic xref table");
                return PdfValidationResult.Failure("Invalid PDF structure: Missing cross-reference table (xref).");
            }

            if (!hasTrailer)
            {
                logger?.LogInformation("PDF validation failed: Missing trailer dictionary");
                return PdfValidationResult.Failure("Invalid PDF structure: Missing trailer dictionary.");
            }
        }
        else if (!hasXrefStream)
        {
            logger?.LogInformation("PDF validation failed: Missing xref/trailer and no cross-reference stream detected");
            return PdfValidationResult.Failure("Invalid PDF structure: Missing cross-reference information.");
        }
        else if (!options.AllowCrossReferenceStreams)
        {
            logger?.LogInformation("PDF validation failed: Cross-reference streams are disabled");
            return PdfValidationResult.Failure("PDFs using cross-reference streams are not allowed.");
        }

        var xrefOffset = checked((int)startXrefValue.Value);
        var xrefTargetPreview = Encoding.Latin1.GetString(data, xrefOffset, Math.Min(512, data.Length - xrefOffset))
            .TrimStart('\0', '\r', '\n', ' ', '\t');
        var pointsToClassicXref = xrefTargetPreview.StartsWith("xref", StringComparison.Ordinal);
        var pointsToXrefStream = XrefStreamRegex.IsMatch(xrefTargetPreview);

        if (hasClassicXref && !pointsToClassicXref)
        {
            logger?.LogInformation("PDF validation failed: startxref does not point to xref table");
            return PdfValidationResult.Failure("Invalid PDF structure: startxref does not point to a cross-reference table.");
        }

        if (!hasClassicXref && hasXrefStream && !pointsToXrefStream)
        {
            logger?.LogInformation("PDF validation failed: startxref does not point to a cross-reference stream");
            return PdfValidationResult.Failure("Invalid PDF structure: startxref does not point to a cross-reference stream.");
        }

        return PdfValidationResult.Success();
    }

    /// <summary>
    /// Checks if file size is within limits.
    /// </summary>
    private static PdfValidationResult CheckFileSize(byte[] data, int maxSizeBytes)
    {
        if (data == null || data.Length == 0)
        {
            return PdfValidationResult.Failure("PDF file is empty");
        }

        if (data.Length > maxSizeBytes)
        {
            var maxSizeMB = maxSizeBytes / (1024.0 * 1024.0);
            return PdfValidationResult.Failure($"PDF file size ({data.Length} bytes) exceeds maximum allowed size of {maxSizeMB:F1} MB");
        }

        return PdfValidationResult.Success();
    }

    private static long? ExtractStartXrefValue(string pdfText, int startXrefIndex)
    {
        var cursor = startXrefIndex + "startxref".Length;

        while (cursor < pdfText.Length && char.IsWhiteSpace(pdfText[cursor]))
        {
            cursor++;
        }

        var start = cursor;
        while (cursor < pdfText.Length && char.IsDigit(pdfText[cursor]))
        {
            cursor++;
        }

        if (start == cursor)
        {
            return null;
        }

        return long.TryParse(pdfText[start..cursor], out var offset) ? offset : null;
    }

    /// <summary>
    /// Checks PDF structural integrity and page count.
    /// </summary>
    private static PdfValidationResult CheckStructure(PdfDocument document, int maxPageCount, ILogger? logger)
    {
        // Check page count
        if (document.PageCount == 0)
        {
            logger?.LogInformation("PDF validation failed: PDF has no pages");
            return PdfValidationResult.Failure("PDF has no pages");
        }

        if (document.PageCount > maxPageCount)
        {
            logger?.LogInformation("PDF validation failed: Page count exceeds limit ({PageCount} > {MaxPageCount})",
                document.PageCount, maxPageCount);
            return PdfValidationResult.Failure($"PDF page count ({document.PageCount}) exceeds maximum allowed pages ({maxPageCount})");
        }

        // Check if document has valid catalog
        if (document.Internals.Catalog == null)
        {
            logger?.LogWarning("PDF validation failed: Missing document catalog");
            return PdfValidationResult.Failure("Invalid PDF structure: Missing document catalog");
        }

        return PdfValidationResult.Success();
    }

    private static PdfValidationResult CheckObjectIntegrity(PdfDocument document, ILogger? logger)
    {
        try
        {
            var catalog = document.Internals.Catalog;
            if (catalog == null)
            {
                logger?.LogWarning("PDF validation failed: Missing catalog during object integrity check");
                return PdfValidationResult.Failure("Invalid PDF structure: Missing document catalog.");
            }

            var pagesRoot = catalog.Elements.GetDictionary("/Pages");
            if (pagesRoot == null)
            {
                logger?.LogWarning("PDF validation failed: Catalog /Pages reference could not be resolved");
                return PdfValidationResult.Failure("Invalid PDF structure: Missing or unresolved page tree.");
            }

            for (var index = 0; index < document.Pages.Count; index++)
            {
                var page = document.Pages[index];
                if (!string.Equals(page.Elements.GetName("/Type"), "/Page", StringComparison.Ordinal))
                {
                    logger?.LogWarning("PDF validation failed: Page {PageIndex} is missing /Type /Page", index);
                    return PdfValidationResult.Failure("Invalid PDF structure: Page object is malformed.");
                }

                if (page.Elements.GetObject("/Parent") == null)
                {
                    logger?.LogWarning("PDF validation failed: Page {PageIndex} missing parent reference", index);
                    return PdfValidationResult.Failure("Invalid PDF structure: Page tree is malformed.");
                }

                var resources = page.Resources;
                if (resources != null && !ValidateXObjectReferences(resources, logger))
                {
                    return PdfValidationResult.Failure("Invalid PDF structure: Unresolved page resource references.");
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "PDF validation failed during object integrity check");
            return PdfValidationResult.Failure($"Invalid PDF structure: {ex.Message}");
        }

        return PdfValidationResult.Success();
    }

    private static bool ValidateXObjectReferences(PdfDictionary resources, ILogger? logger)
    {
        var xObjectDictionary = resources.Elements.GetDictionary("/XObject");
        if (xObjectDictionary == null)
        {
            return true;
        }

        foreach (var key in xObjectDictionary.Elements.Keys)
        {
            var item = xObjectDictionary.Elements.GetObject(key);
            var resolved = ResolveDictionary(item);
            if (resolved == null)
            {
                logger?.LogWarning("PDF validation failed: Could not resolve XObject reference {Key}", key);
                return false;
            }
        }

        return true;
    }

    private static PdfValidationResult CheckImageContent(PdfDocument document, ILogger? logger)
    {
        try
        {
            for (var pageIndex = 0; pageIndex < document.Pages.Count; pageIndex++)
            {
                var page = document.Pages[pageIndex];
                var resources = page.Resources;
                if (resources == null)
                {
                    continue;
                }

                var xObjectDictionary = resources.Elements.GetDictionary("/XObject");
                if (xObjectDictionary == null)
                {
                    continue;
                }

                foreach (var key in xObjectDictionary.Elements.Keys)
                {
                    var item = xObjectDictionary.Elements.GetObject(key);
                    var xObject = ResolveDictionary(item);
                    if (xObject == null)
                    {
                        logger?.LogWarning("PDF validation failed: XObject {Key} on page {PageIndex} could not be resolved", key, pageIndex);
                        return PdfValidationResult.Failure("Invalid PDF image structure: Unresolved XObject reference.");
                    }

                    if (!string.Equals(xObject.Elements.GetName("/Subtype"), "/Image", StringComparison.Ordinal))
                    {
                        continue;
                    }

                    var imageValidationResult = ValidateImageXObject(xObject, key, pageIndex, logger);
                    if (!imageValidationResult.IsValid)
                    {
                        return imageValidationResult;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Error validating PDF images");
            return PdfValidationResult.Failure("Invalid PDF image structure: Unable to validate image content.");
        }

        return PdfValidationResult.Success();
    }

    private static PdfValidationResult ValidateImageXObject(PdfDictionary imageDictionary, string objectKey, int pageIndex, ILogger? logger)
    {
        var width = imageDictionary.Elements.GetInteger("/Width");
        var height = imageDictionary.Elements.GetInteger("/Height");
        if (width <= 0 || height <= 0)
        {
            logger?.LogWarning("PDF validation failed: Image {ObjectKey} on page {PageIndex} has invalid dimensions {Width}x{Height}",
                objectKey, pageIndex, width, height);
            return PdfValidationResult.Failure("Invalid PDF image structure: Image dimensions must be positive.");
        }

        var imageMaskObject = imageDictionary.Elements.GetObject("/ImageMask");
        var isImageMask = string.Equals(imageMaskObject?.ToString(), "true", StringComparison.OrdinalIgnoreCase);

        if (!isImageMask)
        {
            var bitsPerComponent = imageDictionary.Elements.GetInteger("/BitsPerComponent");
            if (bitsPerComponent <= 0)
            {
                logger?.LogWarning("PDF validation failed: Image {ObjectKey} on page {PageIndex} has invalid /BitsPerComponent", objectKey, pageIndex);
                return PdfValidationResult.Failure("Invalid PDF image structure: Missing or invalid /BitsPerComponent.");
            }

            var colorSpaceName = imageDictionary.Elements.GetName("/ColorSpace");
            var colorSpaceObject = imageDictionary.Elements.GetObject("/ColorSpace");
            if (string.IsNullOrEmpty(colorSpaceName) && colorSpaceObject == null)
            {
                logger?.LogWarning("PDF validation failed: Image {ObjectKey} on page {PageIndex} is missing /ColorSpace", objectKey, pageIndex);
                return PdfValidationResult.Failure("Invalid PDF image structure: Missing /ColorSpace.");
            }
        }

        var filterValidationResult = ValidateFilterMetadata(imageDictionary, objectKey, pageIndex, logger);
        if (!filterValidationResult.IsValid)
        {
            return filterValidationResult;
        }

        var stream = imageDictionary.Stream;
        if (stream == null || stream.Length <= 0)
        {
            logger?.LogWarning("PDF validation failed: Image {ObjectKey} on page {PageIndex} is missing stream data", objectKey, pageIndex);
            return PdfValidationResult.Failure("Invalid PDF image structure: Image stream is missing or empty.");
        }

        try
        {
            var rawBytes = stream.Value;
            if (rawBytes == null || rawBytes.Length == 0)
            {
                logger?.LogWarning("PDF validation failed: Image {ObjectKey} on page {PageIndex} has empty raw stream", objectKey, pageIndex);
                return PdfValidationResult.Failure("Invalid PDF image structure: Image stream is empty.");
            }

            if (HasSupportedCompressedFilter(imageDictionary) && !stream.TryUncompress())
            {
                logger?.LogWarning("PDF validation failed: Image {ObjectKey} on page {PageIndex} could not be unfiltered", objectKey, pageIndex);
                return PdfValidationResult.Failure("Invalid PDF image structure: Image stream could not be read.");
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "PDF validation failed: Image {ObjectKey} on page {PageIndex} stream could not be read", objectKey, pageIndex);
            return PdfValidationResult.Failure("Invalid PDF image structure: Image stream could not be read.");
        }

        return PdfValidationResult.Success();
    }

    private static PdfValidationResult ValidateFilterMetadata(PdfDictionary dictionary, string objectKey, int pageIndex, ILogger? logger)
    {
        var directFilter = dictionary.Elements.GetName("/Filter");
        if (!string.IsNullOrEmpty(directFilter))
        {
            return PdfValidationResult.Success();
        }

        var filterArray = dictionary.Elements.GetArray("/Filter");
        if (filterArray == null)
        {
            if (dictionary.Elements.GetObject("/Filter") == null)
            {
                return PdfValidationResult.Success();
            }

            logger?.LogWarning("PDF validation failed: Image {ObjectKey} on page {PageIndex} has unsupported /Filter metadata type", objectKey, pageIndex);
            return PdfValidationResult.Failure("Invalid PDF image structure: Filter metadata is malformed.");
        }

        for (var index = 0; index < filterArray.Elements.Count; index++)
        {
            PdfItem? filterItem = filterArray.Elements[index];
            PdfReference.Dereference(ref filterItem);
            var filterText = filterItem?.ToString();
            if (string.IsNullOrEmpty(filterText) || !filterText.StartsWith("/", StringComparison.Ordinal))
            {
                logger?.LogWarning("PDF validation failed: Image {ObjectKey} on page {PageIndex} contains invalid filter metadata", objectKey, pageIndex);
                return PdfValidationResult.Failure("Invalid PDF image structure: Filter metadata is malformed.");
            }
        }

        return PdfValidationResult.Success();
    }

    private static bool HasSupportedCompressedFilter(PdfDictionary dictionary)
    {
        var directFilter = dictionary.Elements.GetName("/Filter");
        if (!string.IsNullOrEmpty(directFilter))
        {
            return IsSupportedCompressedFilterName(directFilter);
        }

        var filterArray = dictionary.Elements.GetArray("/Filter");
        if (filterArray == null)
        {
            return false;
        }

        for (var index = 0; index < filterArray.Elements.Count; index++)
        {
            PdfItem? filterItem = filterArray.Elements[index];
            PdfReference.Dereference(ref filterItem);
            var filterText = filterItem?.ToString();
            if (string.IsNullOrEmpty(filterText) || !IsSupportedCompressedFilterName(filterText))
            {
                return false;
            }
        }

        return filterArray.Elements.Count > 0;
    }

    private static bool IsSupportedCompressedFilterName(string filterName) =>
        filterName is "/FlateDecode" or "/LZWDecode";

    private static PdfDictionary? ResolveDictionary(PdfObject? item) => item as PdfDictionary;

    /// <summary>
    /// Checks for password protection and encryption.
    /// </summary>
    private static PdfValidationResult CheckSecurity(PdfDocument document, ILogger? logger)
    {
        try
        {
            // Attempt to access a property that triggers decryption.
            var _ = document.PageCount;
        }
        catch (NotSupportedException ex)
        {
            logger?.LogWarning(ex, "PDF validation failed: Password-protected PDF detected");
            return PdfValidationResult.Failure("Password-protected PDFs are not supported. Please provide an unencrypted PDF.");
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Unexpected error during PDF security check");
            return PdfValidationResult.Failure($"Error during PDF security check: {ex.Message}");
        }

        // Additionally check for encryption flag in the catalog
        if (document.Internals.Catalog?.Elements.ContainsKey("/Encrypt") == true)
        {
            logger?.LogWarning("PDF validation failed: Encrypted PDF detected");
            return PdfValidationResult.Failure("Encrypted PDFs are not supported. Please upload an unencrypted PDF.");
        }

        return PdfValidationResult.Success();
    }

    /// <summary>
    /// Checks for malicious content: JavaScript, embedded files, suspicious actions.
    /// </summary>
    private static PdfValidationResult CheckMaliciousContent(PdfDocument document, PdfValidationOptions options, ILogger? logger)
    {
        try
        {
            // Check for JavaScript at document level
            if (options.ScanForJavaScript && HasJavaScript(document, logger))
            {
                logger?.LogWarning("PDF validation failed: JavaScript detected in PDF");
                return PdfValidationResult.Failure("PDFs containing JavaScript are not allowed for security reasons.");
            }

            // Check for embedded files/attachments
            if (options.ScanForEmbeddedFiles && HasEmbeddedFiles(document, logger))
            {
                logger?.LogWarning("PDF validation failed: Embedded files detected in PDF");
                return PdfValidationResult.Failure("PDFs with embedded files or attachments are not allowed for security reasons.");
            }

            // Check for launch actions (auto-execute on open)
            if (HasLaunchActions(document, logger))
            {
                logger?.LogWarning("PDF validation failed: Launch actions detected in PDF");
                return PdfValidationResult.Failure("PDFs with launch actions are not allowed for security reasons.");
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Error scanning PDF for malicious content");
            // If we can't scan for malicious content, reject the PDF (fail closed for security)
            return PdfValidationResult.Failure("Unable to verify PDF security. Please try a different PDF.");
        }

        return PdfValidationResult.Success();
    }

    /// <summary>
    /// Checks if PDF contains JavaScript.
    /// </summary>
    private static bool HasJavaScript(PdfDocument document, ILogger? logger)
    {
        try
        {
            // Check document-level JavaScript
            var catalog = document.Internals.Catalog;
            if (catalog?.Elements.ContainsKey("/Names") == true)
            {
                var names = catalog.Elements.GetDictionary("/Names");
                if (names?.Elements.ContainsKey("/JavaScript") == true)
                {
                    logger?.LogWarning("JavaScript found in document catalog");
                    return true;
                }
            }

            // Check for JavaScript in document-level actions
            if (catalog?.Elements.ContainsKey("/AA") == true || catalog?.Elements.ContainsKey("/OpenAction") == true)
            {
                var aaDict = catalog.Elements.GetDictionary("/AA");
                var openAction = catalog.Elements.GetDictionary("/OpenAction");

                if (ContainsJavaScriptAction(aaDict) || ContainsJavaScriptAction(openAction))
                {
                    logger?.LogWarning("JavaScript found in document actions");
                    return true;
                }
            }

            // Check each page for JavaScript actions
            foreach (PdfPage page in document.Pages)
            {
                if (page.Elements.ContainsKey("/AA"))
                {
                    var pageAA = page.Elements.GetDictionary("/AA");
                    if (ContainsJavaScriptAction(pageAA))
                    {
                        logger?.LogWarning("JavaScript found in page actions");
                        return true;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Error checking for JavaScript in PDF");
            // If we can't determine, assume it might have JS (fail closed)
            return true;
        }

        return false;
    }

    /// <summary>
    /// Checks if a PDF dictionary contains JavaScript actions.
    /// </summary>
    private static bool ContainsJavaScriptAction(PdfDictionary? dict)
    {
        if (dict == null) return false;

        foreach (var key in dict.Elements.Keys)
        {
            var element = dict.Elements[key];

            // Check if it's a JavaScript action
            if (element is PdfDictionary actionDict)
            {
                if (actionDict.Elements.ContainsKey("/S"))
                {
                    var actionType = actionDict.Elements.GetName("/S");
                    if (actionType == "/JavaScript")
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /// <summary>
    /// Checks if PDF has embedded files or attachments.
    /// </summary>
    private static bool HasEmbeddedFiles(PdfDocument document, ILogger? logger)
    {
        try
        {
            var catalog = document.Internals.Catalog;

            // Check for embedded files in Names dictionary
            if (catalog?.Elements.ContainsKey("/Names") == true)
            {
                var names = catalog.Elements.GetDictionary("/Names");
                if (names?.Elements.ContainsKey("/EmbeddedFiles") == true)
                {
                    logger?.LogWarning("Embedded files found in PDF");
                    return true;
                }
            }

            // Check for file attachments in document catalog
            if (catalog?.Elements.ContainsKey("/EmbeddedFiles") == true)
            {
                logger?.LogWarning("Embedded files found in document catalog");
                return true;
            }

            // Check each page for file attachment annotations
            foreach (PdfPage page in document.Pages)
            {
                if (page.Elements.ContainsKey("/Annots"))
                {
                    var annots = page.Elements.GetArray("/Annots");
                    if (annots != null)
                    {
                        foreach (var annotRef in annots.Elements)
                        {
                            if (annotRef is PdfReference reference)
                            {
                                var annot = reference.Value as PdfDictionary;
                                if (annot?.Elements.GetName("/Subtype") == "/FileAttachment")
                                {
                                    logger?.LogWarning("File attachment annotation found on page");
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Error checking for embedded files in PDF");
            // If we can't determine, assume it might have embedded files (fail closed)
            return true;
        }

        return false;
    }

    /// <summary>
    /// Checks if PDF has launch actions (auto-execute on open).
    /// </summary>
    private static bool HasLaunchActions(PdfDocument document, ILogger? logger)
    {
        try
        {
            var catalog = document.Internals.Catalog;

            // Check OpenAction for launch actions
            if (catalog?.Elements.ContainsKey("/OpenAction") == true)
            {
                var openAction = catalog.Elements.GetDictionary("/OpenAction");
                if (openAction?.Elements.GetName("/S") == "/Launch")
                {
                    logger?.LogWarning("Launch action found in OpenAction");
                    return true;
                }
            }

            // Check additional actions
            if (catalog?.Elements.ContainsKey("/AA") == true)
            {
                var aaDict = catalog.Elements.GetDictionary("/AA");
                if (ContainsLaunchAction(aaDict))
                {
                    logger?.LogWarning("Launch action found in document actions");
                    return true;
                }
            }

            // Check pages for launch actions
            foreach (PdfPage page in document.Pages)
            {
                if (page.Elements.ContainsKey("/AA"))
                {
                    var pageAA = page.Elements.GetDictionary("/AA");
                    if (ContainsLaunchAction(pageAA))
                    {
                        logger?.LogWarning("Launch action found in page actions");
                        return true;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Error checking for launch actions in PDF");
            // If we can't determine, assume it might have launch actions (fail closed)
            return true;
        }

        return false;
    }

    /// <summary>
    /// Checks if a PDF dictionary contains launch actions.
    /// </summary>
    private static bool ContainsLaunchAction(PdfDictionary? dict)
    {
        if (dict == null) return false;

        foreach (var key in dict.Elements.Keys)
        {
            var element = dict.Elements[key];

            if (element is PdfDictionary actionDict)
            {
                if (actionDict.Elements.GetName("/S") == "/Launch")
                {
                    return true;
                }
            }
        }

        return false;
    }
}
