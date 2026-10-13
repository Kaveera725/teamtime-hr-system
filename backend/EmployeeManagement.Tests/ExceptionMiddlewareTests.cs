using System.IO;
using System.Text.Json;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

public class ExceptionMiddlewareTests
{
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddlewareTests()
    {
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<ExceptionMiddleware>();
    }

    [Fact]
    public async Task NFR08_NotFoundException_Returns_404_ProblemDetails()
    {
        // Arrange
        RequestDelegate next = _ => throw new NotFoundException("Employee not found.");
        var middleware = new ExceptionMiddleware(next, _logger);
        var context = CreateHttpContext("/api/employees/99");

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);

        var body = await ReadResponseBodyAsync(context);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(404, root.GetProperty("status").GetInt32());
        Assert.Equal("Not Found", root.GetProperty("title").GetString());
        Assert.Equal("Employee not found.", root.GetProperty("detail").GetString());
        Assert.Equal("/api/employees/99", root.GetProperty("instance").GetString());
    }

    [Fact]
    public async Task NFR08_ConflictException_Returns_409_ProblemDetails()
    {
        // Arrange
        RequestDelegate next = _ => throw new ConflictException("Duplicate attendance record.");
        var middleware = new ExceptionMiddleware(next, _logger);
        var context = CreateHttpContext("/api/attendance/check-in");

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);

        var body = await ReadResponseBodyAsync(context);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(409, root.GetProperty("status").GetInt32());
        Assert.Equal("Conflict", root.GetProperty("title").GetString());
        Assert.Equal("Duplicate attendance record.", root.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task NFR08_ForbiddenException_Returns_403_ProblemDetails()
    {
        // Arrange
        RequestDelegate next = _ => throw new ForbiddenException("Cannot approve your own leave.");
        var middleware = new ExceptionMiddleware(next, _logger);
        var context = CreateHttpContext("/api/leave-requests/10/approve");

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);

        var body = await ReadResponseBodyAsync(context);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(403, root.GetProperty("status").GetInt32());
        Assert.Equal("Forbidden", root.GetProperty("title").GetString());
        Assert.Equal("Cannot approve your own leave.", root.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task NFR08_BusinessRuleException_Returns_400_ValidationProblemDetails_With_FieldErrors()
    {
        // Arrange
        RequestDelegate next = _ => throw new BusinessRuleException("Insufficient balance.", "daysRequested");
        var middleware = new ExceptionMiddleware(next, _logger);
        var context = CreateHttpContext("/api/leave-requests");

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);

        var body = await ReadResponseBodyAsync(context);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Equal("Bad Request", root.GetProperty("title").GetString());
        Assert.Equal("Insufficient balance.", root.GetProperty("detail").GetString());
        Assert.True(root.TryGetProperty("errors", out var errors));
        Assert.True(errors.TryGetProperty("daysRequested", out var fieldErrors));
        Assert.Contains("Insufficient balance.", fieldErrors.EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public async Task NFR08_UnhandledException_Returns_500_GenericMessage_No_StackTrace()
    {
        // Arrange
        RequestDelegate next = _ => throw new InvalidOperationException("Internal secret database error with sensitive trace");
        var middleware = new ExceptionMiddleware(next, _logger);
        var context = CreateHttpContext("/api/departments");

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);

        var body = await ReadResponseBodyAsync(context);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(500, root.GetProperty("status").GetInt32());
        Assert.Equal("Internal Server Error", root.GetProperty("title").GetString());
        Assert.Equal("An unexpected error occurred. Please try again later.", root.GetProperty("detail").GetString());

        // Ensure stack trace or internal exception details are NOT exposed to end user
        Assert.False(root.TryGetProperty("stackTrace", out _));
        Assert.DoesNotContain("Internal secret database error", body);
    }

    private static HttpContext CreateHttpContext(string path)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static async Task<string> ReadResponseBodyAsync(HttpContext context)
    {
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        return await reader.ReadToEndAsync();
    }
}
