namespace EmployeeManagement.API.Exceptions;

public class BusinessRuleException : Exception
{
    public IDictionary<string, string[]> Errors { get; }

    public BusinessRuleException(string message) : base(message)
    {
        Errors = new Dictionary<string, string[]>();
    }

    public BusinessRuleException(string message, string field) : base(message)
    {
        Errors = new Dictionary<string, string[]>
        {
            { field, new[] { message } }
        };
    }

    public BusinessRuleException(string message, IDictionary<string, string[]> errors) : base(message)
    {
        Errors = errors ?? new Dictionary<string, string[]>();
    }
}
