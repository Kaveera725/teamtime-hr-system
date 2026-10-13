using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EmployeeManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeSearchAndFilterIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_employees_department_id",
                table: "employees");

            migrationBuilder.CreateIndex(
                name: "ix_employees_department_id_status",
                table: "employees",
                columns: new[] { "department_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_employees_first_name_last_name",
                table: "employees",
                columns: new[] { "first_name", "last_name" });

            migrationBuilder.CreateIndex(
                name: "ix_employees_status",
                table: "employees",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_employees_department_id_status",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "ix_employees_first_name_last_name",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "ix_employees_status",
                table: "employees");

            migrationBuilder.CreateIndex(
                name: "IX_employees_department_id",
                table: "employees",
                column: "department_id");
        }
    }
}
