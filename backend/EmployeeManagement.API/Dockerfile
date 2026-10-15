# Multi-stage Dockerfile for .NET 10 Web API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files first for optimal layer caching
COPY ["EmployeeManagement.API/EmployeeManagement.API.csproj", "EmployeeManagement.API/"]
RUN dotnet restore "EmployeeManagement.API/EmployeeManagement.API.csproj"

# Copy remaining source code and publish
COPY . .
WORKDIR "/src/EmployeeManagement.API"
RUN dotnet publish "EmployeeManagement.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 5000

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Development

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "EmployeeManagement.API.dll"]
