namespace CmsLite.Helpers;

public enum FileSizeUnit
{
    Bytes,
    KB,
    MB
}

public enum SupportedContentType
{
    Json,
    Xml,
    Pdf,
    Csv
}

public class Utilities
{
    /// <summary>
    /// Sanitizes a resource name by normalizing it to a safe, URL-friendly format.
    /// Rules:
    /// - Converts to lowercase
    /// - Replaces spaces with hyphens
    /// - Removes invalid characters (keeps only: ASCII a-z, 0-9, hyphen, underscore, period)
    /// - Removes consecutive hyphens
    /// - Trims leading/trailing hyphens (but preserves periods for file extensions)
    /// </summary>
    /// <param name="resourceName">The resource name to sanitize</param>
    /// <returns>Sanitized resource name</returns>
    public static string SanitizeResourceName(string resourceName)
    {
        if (string.IsNullOrWhiteSpace(resourceName))
            return resourceName;

        // Convert to lowercase
        var sanitized = resourceName.ToLowerInvariant();

        // Replace spaces with hyphens
        sanitized = sanitized.Replace(' ', '-');

        // Remove invalid characters (keep only: ASCII a-z, 0-9, hyphen, underscore, period)
        var validChars = new System.Text.StringBuilder();
        foreach (var c in sanitized)
        {
            // Only allow ASCII alphanumeric and safe punctuation
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.')
            {
                validChars.Append(c);
            }
        }
        sanitized = validChars.ToString();

        // Replace consecutive hyphens with single hyphen
        while (sanitized.Contains("--"))
        {
            sanitized = sanitized.Replace("--", "-");
        }

        // Trim leading/trailing hyphens (but not periods, to preserve file extensions)
        sanitized = sanitized.Trim('-');

        return sanitized;
    }

    public static (string tenant, string resource) ParseTenantResource(string tenant, string resource)
    {
        if (string.IsNullOrWhiteSpace(tenant) || string.IsNullOrWhiteSpace(resource))
            throw new ArgumentException("Tenant and resource are required.");

        // Check for slashes BEFORE sanitization (so we can give clear error messages)
        if (tenant.Contains('/') || resource.Contains('/'))
            throw new ArgumentException("Tenant/resource cannot contain '/'.");

        // Sanitize both tenant and resource names
        tenant = SanitizeResourceName(tenant.Trim());
        resource = SanitizeResourceName(resource.Trim());

        // After sanitization, check if they're still valid
        if (string.IsNullOrWhiteSpace(tenant) || string.IsNullOrWhiteSpace(resource))
            throw new ArgumentException("Tenant and resource names must contain valid characters.");

        return (tenant, resource);
    }

    public static string HashPassword(string password)
    {
        using (var sha256 = System.Security.Cryptography.SHA256.Create())
        {
            var bytes = System.Text.Encoding.UTF8.GetBytes(password);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToBase64String(hash);
        }
    }

    public static bool VerifyPassword(string password, string hashedPassword)
    {
        var hashedInput = HashPassword(password);
        return hashedInput == hashedPassword;
    }

    public static bool IsValidJson(byte[] data)
    {
        try
        {
            System.Text.Json.JsonDocument.Parse(data);
            return true;
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }

    public static bool IsValidXml(byte[] data)
    {
        try
        {
            var doc = new System.Xml.XmlDocument();
            doc.LoadXml(System.Text.Encoding.UTF8.GetString(data));
            return true;
        }
        catch (System.Xml.XmlException)
        {
            return false;
        }
    }

    public static bool IsValidCsv(byte[] data)
    {
        if (data == null || data.Length == 0)
            return false;

        try
        {
            var text = System.Text.Encoding.UTF8.GetString(data);
            // A valid CSV must have at least one non-empty line
            var lines = text.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            return lines.Length > 0;
        }
        catch
        {
            return false;
        }
    }

    public static bool IsValidPdf(byte[] data)
    {
        // PDF files must start with the PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
        if (data == null || data.Length < 5)
        {
            return false;
        }

        // Check for PDF signature at the start
        return data[0] == 0x25 && // %
               data[1] == 0x50 && // P
               data[2] == 0x44 && // D
               data[3] == 0x46 && // F
               data[4] == 0x2D;   // -
    }

    public static bool IsValidJsonWithComments(byte[] data)
    {
        var options = new System.Text.Json.JsonDocumentOptions
        {
            AllowTrailingCommas = true,
            CommentHandling = System.Text.Json.JsonCommentHandling.Skip
        };
        try
        {
            System.Text.Json.JsonDocument.Parse(data, options);
            return true;
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }

    public static (float result, FileSizeUnit unit) CalculateMbFromBytes(long byteCount)
    {
        var result = byteCount / (1024f * 1024f);
        // Round to 2 decimal places
        return ((float)Math.Round(result, 2), FileSizeUnit.MB);
    }

    public static (float result, FileSizeUnit unit) CalculateKbFromBytes(long byteCount)
    {
        var result = byteCount / 1024f;
        // Round to 2 decimal places
        return ((float)Math.Round(result, 2), FileSizeUnit.KB);
    }

    public static string CalculateFileSizeInBestUnit(long byteCount)
    {
        if (byteCount < 0) throw new ArgumentOutOfRangeException(nameof(byteCount), "Byte count must be non-negative.");
        if (byteCount >= 1024 * 1024)
            return $"{CalculateMbFromBytes(byteCount).result} MB";
        else
            return $"{CalculateKbFromBytes(byteCount).result} KB";
    }

    public static SupportedContentType ParseContentType(string contentTypeHeader)
    {
        // Extract just the media type (before any semicolon) and normalize
        var mediaType = contentTypeHeader.Split(';')[0].Trim().ToLower();

        return mediaType switch
        {
            "application/json" => SupportedContentType.Json,
            "application/xml" => SupportedContentType.Xml,
            "text/xml" => SupportedContentType.Xml,
            "application/pdf" => SupportedContentType.Pdf,
            "text/csv" => SupportedContentType.Csv,
            _ => throw new ArgumentException($"Unsupported content type '{mediaType}'. Only 'application/json', 'application/xml', 'text/xml', 'application/pdf', and 'text/csv' are supported.")
        };
    }

    public static string GenerateBlobKey(string tenant, string resource, int version, SupportedContentType contentType)
    {
        var ext = contentType.ToString().ToLower();
        return $"{tenant}/{resource}_v{version}.{ext}";
    }
}
