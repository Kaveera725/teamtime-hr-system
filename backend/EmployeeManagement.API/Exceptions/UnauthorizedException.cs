namespace EmployeeManagement.API.Exceptions;

public class UnauthorizedException : BusinessRuleException
{
    public UnauthorizedException(string message) : base(message) { }
}

