import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { OkPacket } from "mysql2";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";

export async function GET(request: NextRequest) {
  try {
    // Get user info
    const session = await getServerSession(authOptions);
    const user = session?.user;
    console.log("[DEPT API] Session user:", user);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    // First check if department table exists
    try {
      const tableCheck = await query("SHOW TABLES LIKE 'department'");
      console.log("[DEPT API] Table check result:", tableCheck);
      
      if ((tableCheck as any[]).length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Department table does not exist",
            error: "Table 'department' not found"
          },
          { status: 500 }
        );
      }
    } catch (tableError) {
      console.error("[DEPT API] Table check error:", tableError);
      return NextResponse.json(
        {
          success: false,
          message: "Error checking department table",
          error: tableError instanceof Error ? tableError.message : "Unknown table error"
        },
        { status: 500 }
      );
    }

    // Query to get department data with details
    let sql = `
      SELECT 
        d.Department_ID,
        d.Department_Name,
        dd.Establishment_Year,
        dd.Department_Code,
        dd.Email_ID,
        dd.Department_Phone_Number,
        dd.HOD_ID,
        dd.Total_Faculty,
        dd.Total_Students,
        dd.Vision,
        dd.Mission,
        dd.Website_URL
      FROM department d
      LEFT JOIN department_details dd ON d.Department_ID = dd.Department_ID
    `;
    const params: (string | number | boolean | null)[] = [];
    const conditions = [];

    if (search) {
      conditions.push("d.Department_Name LIKE ?");
      params.push(`%${search}%`);
    }

    // Restrict department users to only their own department
    if (user && (user.role as any) === "department" && user.departmentId) {
      conditions.push("d.Department_ID = ?");
      params.push(user.departmentId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY d.Department_Name";

    console.log("[DEPT API] SQL:", sql);
    console.log("[DEPT API] Params:", params);

    const departments = await query(sql, params);
    console.log("[DEPT API] Result count:", (departments as any[]).length);

    // Add HOD information to each department
    const departmentsWithHOD = await Promise.all((departments as any[]).map(async (dept) => {
      let hodInfo = null;
      if (dept.HOD_ID) {
        try {
          const hodQuery = await query("SELECT F_id, F_name FROM faculty WHERE F_id = ?", [dept.HOD_ID]);
          if ((hodQuery as any[]).length > 0) {
            const hod = (hodQuery as any[])[0];
            hodInfo = {
              id: hod.F_id,
              name: hod.F_name
            };
          }
        } catch (error) {
          console.error("Error fetching HOD info:", error);
        }
      }
      
      return {
        ...dept,
        HOD: hodInfo
      };
    }));

    return NextResponse.json({
      success: true,
      data: departmentsWithHOD
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching department data",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { Department_Name } = body;

    if (!Department_Name) {
      return NextResponse.json(
        {
          success: false,
          message: "Department name is required",
        },
        { status: 400 }
      );
    }

    try {
      // Insert into department table
      const result = (await query(
        `
        INSERT INTO department (Department_Name)
        VALUES (?)
      `,
        [Department_Name]
      )) as OkPacket;

      return NextResponse.json({
        success: true,
        Department_ID: result.insertId,
        message: "Department added successfully"
      });
    } catch (insertError) {
      // If the error is related to auto_increment not set up, try to fix it
      if (
        insertError instanceof Error &&
        insertError.message.includes("ER_NO_DEFAULT_FOR_FIELD") &&
        insertError.message.includes("Department_ID")
      ) {
        // First alter the table to add AUTO_INCREMENT to Department_ID
        await query(
          "ALTER TABLE department MODIFY Department_ID INT NOT NULL AUTO_INCREMENT"
        );

        // Then retry the insert
        const result = (await query(
          `
          INSERT INTO department (Department_Name)
          VALUES (?)
        `,
          [Department_Name]
        )) as OkPacket;

        return NextResponse.json({
          success: true,
          Department_ID: result.insertId,
          message: "Department added successfully (with table auto-fix)"
        });
      } else {
        // If it's another kind of error, rethrow it
        throw insertError;
      }
    }
  } catch (error) {
    console.error("Error adding department:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error adding department",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
} 