import { NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { OkPacket } from "mysql2";
import { departments } from "@/app/lib/department-mappings";

export async function GET(request: Request) {
  const diagnosticMode = request.url.includes("diagnostic=true");
  const diagnosticInfo: Record<string, any> = {};

  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const search = searchParams.get("search");

    // Step 1: Verify faculty table exists
    try {
      const tableCheck = await query("SHOW TABLES LIKE 'faculty'");
      diagnosticInfo.tableCheck = { faculty: (tableCheck as any[]).length > 0 };

      if ((tableCheck as any[]).length === 0) {
        throw new Error("Faculty table does not exist");
      }
    } catch (error) {
      console.error("Faculty table check error:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Faculty table not found or inaccessible",
          error: error instanceof Error ? error.message : "Unknown error",
          diagnostic: diagnosticInfo,
        },
        { status: 500 }
      );
    }

    // Step 2: Build the query with proper error handling for joins
    let sql = `
      SELECT 
        f.F_id,
        f.F_name,
        f.F_dept
    `;

    // Check if faculty_details table exists before adding its columns
    let hasDetailsTable = false;
    try {
      const detailsCheck = await query("SHOW TABLES LIKE 'faculty_details'");
      hasDetailsTable = (detailsCheck as any[]).length > 0;

      diagnosticInfo.tableCheck = {
        ...diagnosticInfo.tableCheck,
        faculty_details: hasDetailsTable,
      };

      if (hasDetailsTable) {
        // Get the actual column names to avoid errors
        const detailsColumns = await query("SHOW COLUMNS FROM faculty_details");
        const columnNames = (detailsColumns as any[]).map((col) => col.Field);

        // Only include columns that actually exist
        const emailCol = columnNames.includes("Email")
          ? "fd.Email"
          : "NULL as Email";
        const phoneCol = columnNames.includes("Phone_Number")
          ? "fd.Phone_Number"
          : "NULL as Phone_Number";
        const designationCol = columnNames.includes("Current_Designation")
          ? "fd.Current_Designation"
          : "NULL as Current_Designation";
        const degreeCol = columnNames.includes("Highest_Degree")
          ? "fd.Highest_Degree"
          : "NULL as Highest_Degree";
        const experienceCol = columnNames.includes("Experience")
          ? "fd.Experience"
          : "NULL as Experience";

        sql += `,
          ${emailCol},
          ${phoneCol},
          ${designationCol},
          ${degreeCol},
          ${experienceCol}`;
      } else {
        // Add placeholder columns if table doesn't exist
        sql += `,
          NULL as Email,
          NULL as Phone_Number,
          NULL as Current_Designation,
          NULL as Highest_Degree,
          NULL as Experience`;
      }
    } catch (error) {
      console.error("Faculty details check error:", error);
      // Continue with placeholders for these columns
      sql += `,
        NULL as Email,
        NULL as Phone_Number,
        NULL as Current_Designation,
        NULL as Highest_Degree,
        NULL as Experience`;
    }

    // Check for contributions table
    let hasContributions = false;
    try {
      const contributionsCheck = await query(
        "SHOW TABLES LIKE 'faculty_contributions'"
      );
      diagnosticInfo.tableCheck = {
        ...diagnosticInfo.tableCheck,
        faculty_contributions: (contributionsCheck as any[]).length > 0,
      };

      hasContributions = (contributionsCheck as any[]).length > 0;

      // Add contribution count with safe SQL
      if (hasContributions) {
        sql += `,
          (SELECT COUNT(*) FROM faculty_contributions WHERE F_ID = f.F_id) as total_contributions`;
      } else {
        sql += `,
          0 as total_contributions`;
      }
    } catch (error) {
      console.error("Error checking faculty_contributions:", error);
      sql += `,
        0 as total_contributions`;
    }

    // Check for professional_body table
    let hasProfessionalBody = false;
    try {
      const professionalBodyCheck = await query(
        "SHOW TABLES LIKE 'faculty_professional_body'"
      );
      diagnosticInfo.tableCheck = {
        ...diagnosticInfo.tableCheck,
        faculty_professional_body: (professionalBodyCheck as any[]).length > 0,
      };

      hasProfessionalBody = (professionalBodyCheck as any[]).length > 0;

      // Add professional membership count with safe SQL
      if (hasProfessionalBody) {
        sql += `,
          (SELECT COUNT(*) FROM faculty_professional_body WHERE F_ID = f.F_id) as professional_memberships`;
      } else {
        sql += `,
          0 as professional_memberships`;
      }
    } catch (error) {
      console.error("Error checking faculty_professional_body:", error);
      sql += `,
        0 as professional_memberships`;
    }

    // Check for publications table and add publications count
    let hasPublications = false;
    let hasBookChapters = false;
    try {
      const publicationsCheck = await query(
        "SHOW TABLES LIKE 'faculty_publications'"
      );
      diagnosticInfo.tableCheck = {
        ...diagnosticInfo.tableCheck,
        faculty_publications: (publicationsCheck as any[]).length > 0,
      };

      hasPublications = (publicationsCheck as any[]).length > 0;

      // Also check for bookschapter table
      const booksCheck = await query("SHOW TABLES LIKE 'bookschapter'");
      diagnosticInfo.tableCheck = {
        ...diagnosticInfo.tableCheck,
        bookschapter: (booksCheck as any[]).length > 0,
      };

      hasBookChapters = (booksCheck as any[]).length > 0;

      // Add publications count with safe SQL combining both tables
      if (hasPublications && hasBookChapters) {
        sql += `,
          (
            (SELECT COUNT(*) FROM faculty_publications WHERE faculty_id = f.F_id) +
            (SELECT COUNT(*) FROM bookschapter WHERE user_id = f.F_id AND STATUS = 'approved')
          ) as publication_count`;
      } else if (hasPublications) {
        sql += `,
          (SELECT COUNT(*) FROM faculty_publications WHERE faculty_id = f.F_id) as publication_count`;
      } else if (hasBookChapters) {
        sql += `,
          (SELECT COUNT(*) FROM bookschapter WHERE user_id = f.F_id AND STATUS = 'approved') as publication_count`;
      } else {
        sql += `,
          0 as publication_count`;
      }
    } catch (error) {
      console.error("Error checking publications tables:", error);
      sql += `,
        0 as publication_count`;
    }

    // Main table
    sql += ` FROM faculty f`;

    // Add LEFT JOINs conditionally
    let hasDetailsJoin = false;
    try {
      const detailsCheck = await query("SHOW TABLES LIKE 'faculty_details'");
      if ((detailsCheck as any[]).length > 0) {
        sql += ` LEFT JOIN faculty_details fd ON f.F_id = fd.F_ID`;
        hasDetailsJoin = true;
      }
    } catch (error) {
      console.error("Error checking faculty_details for JOIN:", error);
      // Skip the join if there's an error
    }

    const params: (string | number | boolean | null)[] = [];
    const conditions = [];

    if (department) {
      conditions.push("f.F_dept = ?");
      params.push(department);
    }

    if (search) {
      // Check if we have fd in the query
      if (hasDetailsJoin) {
        conditions.push("(f.F_name LIKE ? OR fd.Email LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      } else {
        conditions.push("f.F_name LIKE ?");
        params.push(`%${search}%`);
      }
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    // Ensure the GROUP BY only includes columns that exist in the query
    sql += " GROUP BY f.F_id, f.F_name, f.F_dept";

    // Add additional GROUP BY columns if we know they exist
    if (hasDetailsJoin) {
      sql +=
        ", fd.Email, fd.Phone_Number, fd.Current_Designation, fd.Highest_Degree, fd.Experience";
    }

    // Execute the query
    diagnosticInfo.sql = sql;
    diagnosticInfo.params = params;

    const faculty = await query(sql, params);
    diagnosticInfo.querySuccess = true;
    diagnosticInfo.resultCount = (faculty as any[]).length;

    return NextResponse.json({
      success: true,
      data: faculty,
      diagnostic: diagnosticMode ? diagnosticInfo : undefined,
    });
  } catch (error) {
    console.error("Error fetching faculty:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching faculty data",
        error: error instanceof Error ? error.message : "Unknown error",
        diagnostic: diagnosticInfo,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { F_name, F_dept } = body;

    if (!F_name || !F_dept) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and department are required",
        },
        { status: 400 }
      );
    }

    // Find the department configuration
    const department = departments.find((dept) => dept.name === F_dept);
    if (!department) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid department selected",
        },
        { status: 400 }
      );
    }

    try {
      // Get the next faculty ID for this department
      // Find the highest existing faculty ID with this department prefix
      const existingFacultyIds = (await query(
        `SELECT F_id FROM faculty WHERE F_id LIKE ? ORDER BY F_id DESC LIMIT 1`,
        [`${department.facultyIdPrefix}%`]
      )) as any[];

      let nextId: number;
      if (existingFacultyIds.length > 0) {
        // Extract the numeric part after the prefix and increment
        const lastId = existingFacultyIds[0].F_id;
        const numericPart = parseInt(
          lastId
            .toString()
            .substring(department.facultyIdPrefix.toString().length)
        );
        nextId = parseInt(
          `${department.facultyIdPrefix}${(numericPart + 1)
            .toString()
            .padStart(2, "0")}`
        );
      } else {
        // First faculty for this department, start with prefix + 01
        nextId = parseInt(`${department.facultyIdPrefix}01`);
      }

      // Insert into faculty table with the generated ID
      const result = (await query(
        `INSERT INTO faculty (F_id, F_name, F_dept) VALUES (?, ?, ?)`,
        [nextId, F_name, F_dept]
      )) as OkPacket;

      return NextResponse.json({
        success: true,
        F_id: nextId,
        message: `Faculty added successfully with ID: ${nextId}`,
      });
    } catch (insertError) {
      console.error("Error inserting faculty:", insertError);
      throw insertError;
    }
  } catch (error) {
    console.error("Error adding faculty:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error adding faculty",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
