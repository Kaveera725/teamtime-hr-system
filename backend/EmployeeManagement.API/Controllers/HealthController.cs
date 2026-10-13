using EmployeeManagement.API.Data;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeManagement.API.Controllers;

[ApiController]
[Route("[controller]")]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<HealthController> _logger;

    public HealthController(ApplicationDbContext dbContext, ILogger<HealthController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        try
        {
            var canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);
            if (!canConnect)
            {
                _logger.LogWarning("Health check failed: Unable to connect to the PostgreSQL database");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    status = "Unhealthy",
                    database = "Disconnected",
                    timestamp = DateTime.UtcNow,
                    service = "EmployeeManagement.API"
                });
            }

            return Ok(new
            {
                status = "Healthy",
                database = "Connected",
                timestamp = DateTime.UtcNow,
                service = "EmployeeManagement.API"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check exception while connecting to database");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                status = "Unhealthy",
                database = "Error",
                timestamp = DateTime.UtcNow,
                service = "EmployeeManagement.API"
            });
        }
    }
}
