using System.Text.Json;
using EmployeeManagement.API.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/problem+json";

        ProblemDetails problemDetails;

        switch (exception)
        {
            case BusinessRuleException businessRuleEx:
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                var validationProblem = new HttpValidationProblemDetails(
                    businessRuleEx.Errors.Count > 0
                        ? businessRuleEx.Errors
                        : new Dictionary<string, string[]> { { "rule", new[] { businessRuleEx.Message } } })
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Bad Request",
                    Detail = businessRuleEx.Message,
                    Instance = context.Request.Path
                };
                problemDetails = validationProblem;
                _logger.LogWarning("Business rule violation at {Path}: {Message}", context.Request.Path, businessRuleEx.Message);
                break;

            case ArgumentException argumentEx:
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                var argProblem = new HttpValidationProblemDetails(
                    new Dictionary<string, string[]>
                    {
                        { argumentEx.ParamName ?? "general", new[] { argumentEx.Message } }
                    })
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Bad Request",
                    Detail = argumentEx.Message,
                    Instance = context.Request.Path
                };
                problemDetails = argProblem;
                _logger.LogWarning("Argument error at {Path}: {Message}", context.Request.Path, argumentEx.Message);
                break;

            case ForbiddenException forbiddenEx:
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                problemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = forbiddenEx.Message,
                    Instance = context.Request.Path
                };
                _logger.LogWarning("Forbidden access attempt at {Path}: {Message}", context.Request.Path, forbiddenEx.Message);
                break;

            case NotFoundException notFoundEx:
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                problemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Not Found",
                    Detail = notFoundEx.Message,
                    Instance = context.Request.Path
                };
                _logger.LogInformation("Resource not found at {Path}: {Message}", context.Request.Path, notFoundEx.Message);
                break;

            case ConflictException conflictEx:
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                problemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Conflict",
                    Detail = conflictEx.Message,
                    Instance = context.Request.Path
                };
                _logger.LogWarning("Conflict at {Path}: {Message}", context.Request.Path, conflictEx.Message);
                break;

            case DbUpdateConcurrencyException concurrencyEx:
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                problemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Conflict",
                    Detail = "The record was modified or approved by another user. Please refresh and try again.",
                    Instance = context.Request.Path
                };
                _logger.LogWarning(concurrencyEx, "Concurrency conflict at {Path}", context.Request.Path);
                break;

            default:
                _logger.LogError(exception, "Unhandled exception occurred while processing request {Method} {Path}",
                    context.Request.Method, context.Request.Path);

                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                problemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status500InternalServerError,
                    Title = "Internal Server Error",
                    Detail = "An unexpected error occurred. Please try again later.",
                    Instance = context.Request.Path
                };
                break;
        }

        var json = JsonSerializer.Serialize(problemDetails, problemDetails.GetType(), JsonOptions);
        await context.Response.WriteAsync(json);
    }
}
