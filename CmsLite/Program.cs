using Microsoft.EntityFrameworkCore;
using Azure.Storage.Blobs;
using CmsLite.Database.Repositories;
using CmsLite.Database;
using CmsLite.Authentication;
using CmsLite.Content;
using CmsLite.Helpers;
using CmsLite.Helpers.RequestMappers;
using CmsLite.Monitoring;
using Microsoft.OpenApi.Models;
using CmsLite.Middlewares;
using System.Text.Json;
using CmsLite.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

var configuration = builder.Configuration;
var storageConnectionString = configuration["AzureStorage:ConnectionString"] ?? throw new InvalidOperationException("Azure Storage connection string is not configured.");
var containerName = configuration["AzureStorage:Container"] ?? "cms";
var dbPath = configuration["Database:Path"] ?? "cmslite.db";
// Add database services
builder.Services.AddDbContext<CmsLiteDbContext>(options =>
{
    options.UseSqlite($"Data Source={dbPath}");
});
// Add blob storage services
builder.Services.AddSingleton(_ => new BlobServiceClient(storageConnectionString));
builder.Services.AddSingleton<IBlobRepo, BlobRepo>();
builder.Services.Configure<PdfValidationOptions>(configuration.GetSection("PdfValidation"));
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

builder.AddCmsLiteAuthentication();
builder.AddCmsRepositories();
builder.AddLoggingServices();
builder.AddCmsRateLimiting();

// Add Swagger/OpenAPI services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "CMS-Lite API",
        Version = "v1",
        Description = "A lightweight, multi-tenant JSON content management system with JWT authentication",
        Contact = new OpenApiContact
        {
            Name = "CMS-Lite",
            Url = new Uri("https://github.com/mgr-tsc/cms-lite")
        }
    });
    // Include XML comments for better documentation
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }

    // Add JWT Authentication to Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
builder.Services.AddCors();
var app = builder.Build();

// Health endpoint
app.MapGet("/health", (IHostEnvironment env) =>
{
    var envValue = env.EnvironmentName;
    return Results.Ok(new { env = envValue });
}).WithDescription("Check the health of the application.").WithTags("Health");

// Signup endpoint (only in development)
app.MapPost("/attach-user", async (SignUpRequest request, IUserRepo userRepo, ITenantRepo tenantRepo) =>
{
    var tenant = await tenantRepo.GetTenantByIdAsync(request.TenantId);
    if (tenant == null)
    {
        return Results.BadRequest($"Tenant with ID {request.TenantId} does not exist.");
    }
    var existingUser = await userRepo.GetUserByEmailAsync(request.Email);
    if (existingUser != null)
    {
        return Results.Conflict("A user with this email already exists.");
    }
    var newUser = new DbSet.User
    {
        Id = Guid.NewGuid().ToString(),
        Email = request.Email,
        FirstName = request.FirstName,
        LastName = request.LastName,
        PasswordHash = CmsLite.Helpers.Utilities.HashPassword(request.Password),
        TenantId = request.TenantId,
        IsActive = true
    };
    try
    {
        await userRepo.CreateUserAsync(newUser);
    }
    catch
    {
        return Results.Problem("An error occurred while attaching the user.");
    }
    return Results.Ok(new
    {
        message = "User attached successfully",
        email = request.Email,
        firstName = request.FirstName,
        lastName = request.LastName,
        tenantId = request.TenantId
    });
}).RequireAuthorization().WithDescription("Attach a new user to an existing tenant.").WithTags("SignUp").RequireRateLimiting("admin");

app.MapPost("/create-tenant", async (CreateTenantRequest request, ITenantRepo tenantRepo, IUserRepo userRepo, IDirectoryRepo directoryRepo, CmsLiteDbContext dbContext) =>
{
    var existingTenant = await tenantRepo.GetTenantByNameAsync(request.Name);
    if (existingTenant != null)
    {
        return Results.Conflict("A tenant with this name already exists.");
    }
    using var transaction = await dbContext.Database.BeginTransactionAsync();
    try
    {
        var newTenant = new DbSet.Tenant
        {
            Id = Guid.NewGuid().ToString(),
            Name = request.Name,
            Description = request.Description
        };
        var newUser = new DbSet.User
        {
            Id = Guid.NewGuid().ToString(),
            Email = request.OwnerEmail,
            FirstName = request.OwnerFirstName,
            LastName = request.OwnerLastName,
            PasswordHash = CmsLite.Helpers.Utilities.HashPassword(request.OwnerPassword),
            TenantId = newTenant.Id,
            IsActive = true
        };
        var newRootDirectory = new DbSet.Directory
        {
            Id = Guid.NewGuid().ToString(),
            Name = "root",
            TenantId = newTenant.Id,
            Level = 0,
            ParentId = null
        };
        await tenantRepo.CreateTenantAsync(newTenant);
        await directoryRepo.CreateDirectoryAsync(newRootDirectory);
        await userRepo.CreateUserAsync(newUser);
        await transaction.CommitAsync();
        return Results.Ok(new
        {
            message = "Tenant and owner user created successfully",
            tenantId = newTenant.Id,
            ownerUserId = newUser.Id
        });
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}).WithDescription("Create a new tenant along with its owner user.").WithTags("SignUp").RequireRateLimiting("admin");

// Initialize database
using (var scope = app.Services.CreateScope())
{
    var scopedServices = scope.ServiceProvider;
    var db = scopedServices.GetRequiredService<CmsLiteDbContext>();
    _ = scopedServices.GetRequiredService<IBlobRepo>();
    db.Database.EnsureCreated();
}

// Configure Swagger middleware
if (app.Environment.IsDevelopment() || app.Environment.EnvironmentName == "Local")
{
    app.UseSwagger();
    app.UseCors(policy =>
        policy.WithOrigins("http://localhost:5174", "http://localhost:9090", "http://host.docker.internal:9090") // Adjust the origin as needed
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "CMS-Lite API v1");
        c.RoutePrefix = "swagger";
        c.DocumentTitle = "CMS-Lite API Documentation";
        c.DisplayRequestDuration();
        c.EnableTryItOutByDefault();
    });
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseHttpsRedirection();
}

app.UseCmsLiteAuthentication();
app.UseMiddleware<TenantValidationMiddleware>();
app.UseRateLimiter();

var apiGroup = app.MapGroup("/api");
apiGroup.MapAuthenticationEndpoints();
apiGroup.MapContentEndpoints();
apiGroup.MapDirectoryEndpoints();
apiGroup.MapFavoritesEndpoint();

app.Run();
public partial class Program { }
