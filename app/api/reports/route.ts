import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { RowInput, UserOptions } from "jspdf-autotable";
import {
  getFacultyReportData,
  getStudentsReportData,
  getResearchReportData,
} from "@/app/lib/report-data";
import { RowDataPacket } from "mysql2";
import fs from "fs";
import path from "path";

// Extend jsPDF with autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: UserOptions) => jsPDF;
  }
}

// Helper function to get faculty details for signature
const getFacultyForSignature = async (
  departmentName?: string
): Promise<{
  facultyName: string;
  signatureUrl?: string;
}> => {
  try {
    // If department is specified, try to get the first faculty member from that department
    // Otherwise, get any faculty member (could be enhanced to get current user's info)
    let facultyQuery = `
      SELECT 
        f.F_name as name,
        fd.signature_url
      FROM 
        faculty f
      LEFT JOIN 
        faculty_details fd ON f.F_id = fd.F_ID
    `;

    const params: (string | number)[] = [];

    if (departmentName && departmentName !== "All Departments") {
      facultyQuery += " WHERE f.F_dept = ?";
      params.push(departmentName);
    }

    facultyQuery += " ORDER BY f.F_id LIMIT 1";

    const facultyData = (await query(facultyQuery, params)) as RowDataPacket[];

    if (facultyData && facultyData.length > 0) {
      return {
        facultyName: facultyData[0].name || "Prof. XXXX XXXX",
        signatureUrl: facultyData[0].signature_url,
      };
    }

    return {
      facultyName: "Prof. XXXX XXXX",
      signatureUrl: undefined,
    };
  } catch (error) {
    console.error("Error fetching faculty for signature:", error);
    return {
      facultyName: "Prof. XXXX XXXX",
      signatureUrl: undefined,
    };
  }
};

// Department to HOD mapping
const getDepartmentHOD = (department: string): string => {
  const hodMapping: { [key: string]: string } = {
    "Computer Engineering": "Dr. Rahul Khanna",
    "Electronics and Telecommunications": "Dr. Sanjay Kumar",
    "Mechanical Engineering": "Prof. Amit Sharma",
    "Civil Engineering": "Dr. Priya Singh",
    "Information Technology": "Prof. Rajesh Gupta",
    "Electrical Engineering": "Dr. Neha Patel",
    EXTC: "Dr. Sanjay Kumar",
  };
  return hodMapping[department] || "Prof. XXX XXX";
};

// Helper function to add institutional letterhead to PDF
const addInstitutionalLetterhead = async (
  doc: jsPDF,
  reportTitle: string,
  departmentName?: string
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;

  // Add letterhead logo - use actual logo from public folder
  try {
    // For server-side PDF generation, we need to load the image from the file system
    try {
      const logoPath = path.join(process.cwd(), "public", "report-logo.jpg");
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString("base64");
        doc.addImage(
          `data:image/jpeg;base64,${logoBase64}`,
          "JPEG",
          15,
          15,
          25,
          25
        );
      } else {
        throw new Error("Logo file not found");
      }
    } catch (logoError) {
      console.warn("Could not load logo file:", logoError);
      // Fallback: Logo placeholder box
      doc.rect(15, 15, 25, 25);
      doc.setFontSize(8);
      doc.text("LOGO", 22, 30);
    }
  } catch (logoError) {
    // Fallback: Logo placeholder box
    doc.rect(15, 15, 25, 25);
    doc.setFontSize(8);
    doc.text("LOGO", 22, 30);
  }

  // College header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Agnel Charities", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(16);
  doc.text(
    "Fr. C. Rodrigues Institute of Technology, Vashi",
    pageWidth / 2,
    28,
    { align: "center" }
  );

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    "(An Autonomous Institute & Permanently Affiliated to University of Mumbai)",
    pageWidth / 2,
    35,
    { align: "center" }
  );

  // Dynamic report title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(reportTitle, pageWidth / 2, 50, {
    align: "center",
  });

  // Add date and department info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let yPos = 65;
  doc.text(
    `Generated on: ${new Date().toLocaleDateString("en-IN")}`,
    margin,
    yPos
  );

  if (departmentName && departmentName !== "All Departments") {
    yPos += 7;
    doc.text(`Department: ${departmentName}`, margin, yPos);
  }

  return yPos + 10; // Return the Y position where content can start
};

// Helper function to add signature section to PDF
const addSignatureSection = (
  doc: jsPDF,
  startY: number,
  facultyName: string = "Prof. XXXX XXXX",
  departmentName: string = "",
  facultySignatureUrl?: string
): void => {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;

  // Add signature section
  const signatureY = Math.max(startY + 30, doc.internal.pageSize.height - 80);

  // Faculty signature (left side)
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Faculty Signature:", margin, signatureY);

  // Add faculty signature image if available
  if (facultySignatureUrl) {
    try {
      doc.addImage(facultySignatureUrl, "PNG", margin, signatureY + 5, 40, 15);
    } catch (sigError) {
      console.warn("Could not add signature image:", sigError);
      doc.line(margin, signatureY + 15, margin + 60, signatureY + 15); // Fallback signature line
    }
  } else {
    doc.line(margin, signatureY + 15, margin + 60, signatureY + 15); // Signature line
  }

  doc.text(facultyName, margin, signatureY + 25);
  doc.text("Faculty", margin, signatureY + 32);

  // HOD signature (right side)
  const hodX = pageWidth - margin - 60;
  doc.text("HOD Signature:", hodX, signatureY);
  doc.line(hodX, signatureY + 15, hodX + 60, signatureY + 15); // Signature line (HOD signature will be blank as requested)

  // Get HOD name based on department
  const hodName = getDepartmentHOD(departmentName);
  doc.text(hodName, hodX, signatureY + 25);
  doc.text("Head of Department", hodX, signatureY + 32);
};

export async function POST(request: NextRequest) {
  try {
    // Check if the request has a body before trying to parse it
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, message: "Invalid content type. Expected JSON." },
        { status: 400 }
      );
    }

    // Clone the request to read the body as text first for debugging
    const clonedRequest = request.clone();
    const rawBody = await clonedRequest.text();

    if (!rawBody || rawBody.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Empty request body" },
        { status: 400 }
      );
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError, "Raw body:", rawBody);
      return NextResponse.json(
        { success: false, message: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { reportType, departmentId, format = "pdf" } = body;

    // If JSON format is requested, return the raw data
    if (format === "json") {
      let tableData;
      let columns;

      switch (reportType) {
        case "faculty":
          [tableData, columns] = await getFacultyReportData(departmentId);
          break;
        case "student":
          [tableData, columns] = await getStudentsReportData(departmentId);
          break;
        case "research":
          [tableData, columns] = await getResearchReportData(departmentId);
          break;
        case "full":
        default:
          // For full reports, we'll combine data
          const [facultyData] = await getFacultyReportData(departmentId);
          const [studentData] = await getStudentsReportData(departmentId);
          const [researchData] = await getResearchReportData(departmentId);
          tableData = {
            faculty: facultyData,
            student: studentData,
            research: researchData,
          };
          break;
      }

      return NextResponse.json({
        success: true,
        message: "Report data retrieved successfully",
        data: {
          reportType,
          departmentId: departmentId || "all",
          generatedAt: new Date().toISOString(),
          tableData,
          columns,
        },
      });
    }

    // Otherwise generate PDF as usual
    let pdfDoc: jsPDF;
    let filename: string;

    switch (reportType) {
      case "faculty":
        [pdfDoc, filename] = await generateFacultyReport(departmentId);
        break;
      case "student":
        [pdfDoc, filename] = await generateStudentsReport(departmentId);
        break;
      case "research":
        [pdfDoc, filename] = await generateResearchReport(departmentId);
        break;
      case "full":
      default:
        [pdfDoc, filename] = await generateFullReport(departmentId);
        break;
    }

    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));

    // Store the PDF in a file or database in a real implementation
    // For now, we'll encode it as base64 and return it in the response
    const base64PDF = pdfBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      message: "Report generated successfully",
      data: {
        reportType,
        departmentId: departmentId || "all",
        generatedAt: new Date().toISOString(),
        filename,
        pdfBase64: base64PDF,
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate report" },
      { status: 500 }
    );
  }
}

// Define interfaces for data types
interface FacultyData {
  F_id: number;
  F_name: string;
  F_dept: string;
  Email: string;
  Current_Designation: string | null;
  Highest_Degree: string | null;
  Experience: number | null;
  Date_of_Joining: string | null;
  // We'll determine HOD status by comparing with department.HOD_ID
  isHOD?: boolean; // Calculated field, not from database
}

interface DepartmentStats {
  Department: string;
  TotalFaculty: number;
  Professors: number;
  AssociateProfessors: number;
  AssistantProfessors: number;
}

interface ResearchItem {
  F_name: string;
  F_dept: string;
  Title: string | null;
  Type: string | null;
  Year: number | string | null;
  Journal_Conference: string | null;
}

interface ResearchStats {
  Department: string;
  TotalContributions: number;
  JournalPublications: number;
  ConferencePublications: number;
  ResearchProjects: number;
}

// Helper function to generate faculty report
async function generateFacultyReport(
  departmentId?: string
): Promise<[jsPDF, string]> {
  const doc = new jsPDF();
  const filename = `faculty_report_${departmentId || "all"}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;

  // Add title
  doc.setFontSize(18);
  doc.text("Faculty Report", 14, 22);

  // Add report metadata
  doc.setFontSize(11);
  doc.text(`Department: ${departmentId || "All Departments"}`, 14, 30);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);

  // Fetch faculty data
  let facultyQuery = `SELECT 
    f.F_id,
    f.F_name,
    f.F_dept,
    fd.Email,
    fd.Current_Designation,
    fd.Highest_Degree,
    fd.Experience,
    fd.Date_of_Joining,
    (f.F_id = (
      SELECT dd.HOD_ID 
      FROM department d 
      LEFT JOIN department_details dd ON d.Department_ID = dd.Department_ID 
      WHERE d.Department_Name = f.F_dept
    )) AS isHOD
  FROM faculty f
  LEFT JOIN faculty_details fd ON f.F_id = fd.F_ID`;

  const params: (string | number)[] = [];
  if (departmentId && departmentId !== "all") {
    facultyQuery += " WHERE f.F_dept = ?";
    params.push(departmentId);
  }

  // Add ORDER BY clause with hierarchical sorting
  // First priority - HOD status (using departments.HOD_ID), then designation, then date of joining
  facultyQuery += ` ORDER BY 
    CASE 
      WHEN f.F_id = (
        SELECT dd.HOD_ID 
        FROM department d 
        LEFT JOIN department_details dd ON d.Department_ID = dd.Department_ID 
        WHERE d.Department_Name = f.F_dept
      ) THEN 0
      ELSE 1
    END,
    CASE 
      WHEN fd.Current_Designation = 'Professor' THEN 1
      WHEN fd.Current_Designation = 'Associate Professor' THEN 2
      WHEN fd.Current_Designation = 'Assistant Professor' THEN 3
      ELSE 4
    END,
    fd.Date_of_Joining`;

  const facultyData = (await query(facultyQuery, params)) as FacultyData[];
  if (!facultyData || !Array.isArray(facultyData) || facultyData.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(255, 0, 0);
    doc.text("No faculty data found", 14, 50);
    return [doc, filename];
  }

  // Prepare data for table
  const tableData = facultyData.map((faculty) => [
    faculty.F_name,
    faculty.F_dept,
    (faculty.isHOD ? "HoD - " : "") + (faculty.Current_Designation || "N/A"),
    faculty.Highest_Degree || "N/A",
    faculty.Experience?.toString() || "N/A",
    faculty.Date_of_Joining
      ? new Date(faculty.Date_of_Joining).toLocaleDateString()
      : "N/A",
    faculty.Email || "N/A",
  ]) as RowInput[];
  // Add table
  autoTable(doc, {
    head: [
      [
        "Name",
        "Department",
        "Designation",
        "Highest Degree",
        "Experience (Years)",
        "Date of Joining",
        "Email",
      ],
    ],
    body: tableData,
    startY: 45,
    theme: "grid",
    headStyles: { fillColor: [75, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 240, 255] },
    margin: { top: 45 },
  });

  // Department-wise statistics
  doc.addPage();
  doc.setFontSize(16);
  doc.text("Faculty Statistics by Department", 14, 22);

  // Fetch department-wise statistics
  const statsQuery = `
    SELECT 
      f.F_dept AS Department,
      COUNT(*) AS TotalFaculty,
      SUM(CASE WHEN fd.Current_Designation = 'Professor' THEN 1 ELSE 0 END) AS Professors,
      SUM(CASE WHEN fd.Current_Designation = 'Associate Professor' THEN 1 ELSE 0 END) AS AssociateProfessors,
      SUM(CASE WHEN fd.Current_Designation = 'Assistant Professor' THEN 1 ELSE 0 END) AS AssistantProfessors
    FROM faculty f
    LEFT JOIN faculty_details fd ON f.F_id = fd.F_ID
    ${departmentId && departmentId !== "all" ? "WHERE f.F_dept = ?" : ""}
    GROUP BY f.F_dept
    ORDER BY f.F_dept
  `;

  const statsParams =
    departmentId && departmentId !== "all" ? [departmentId] : [];
  const statsData = (await query(statsQuery, statsParams)) as DepartmentStats[];

  if (statsData && Array.isArray(statsData) && statsData.length > 0) {
    const statsTableData = statsData.map((stat) => [
      stat.Department || "N/A",
      stat.TotalFaculty?.toString() || "0",
      stat.Professors?.toString() || "0",
      stat.AssociateProfessors?.toString() || "0",
      stat.AssistantProfessors?.toString() || "0",
    ]) as RowInput[];

    autoTable(doc, {
      head: [
        [
          "Department",
          "Total Faculty",
          "Professors",
          "Associate Professors",
          "Assistant Professors",
        ],
      ],
      body: statsTableData,
      startY: 30,
      theme: "grid",
      headStyles: { fillColor: [75, 70, 229], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 240, 255] },
    });
  }

  // Add footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.text(
      "Information Management System - NAAC/NBA Reports",
      14,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  return [doc, filename];
}

// Helper function to generate student report
async function generateStudentsReport(
  departmentId?: string
): Promise<[jsPDF, string]> {
  const doc = new jsPDF();
  const filename = `student_report_${departmentId || "all"}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;

  // Get department name for display
  let departmentName = "All Departments";
  if (departmentId && departmentId !== "all") {
    try {
      const deptQuery = `SELECT Department_Name FROM department WHERE Department_ID = ?`;
      const deptResult = (await query(deptQuery, [
        parseInt(departmentId, 10),
      ])) as RowDataPacket[];
      if (deptResult && deptResult.length > 0) {
        departmentName = deptResult[0].Department_Name;
      }
    } catch (error) {
      console.error("Error fetching department name:", error);
    }
  }

  // Add institutional letterhead with dynamic title
  const contentStartY = await addInstitutionalLetterhead(
    doc,
    "Student Enrollment Report",
    departmentName
  );

  try {
    // Fetch student data from the database based on the actual structure
    let studentsQuery = `
      SELECT 
        s.id,
        s.username as name,
        s.email,
        s.branch,
        s.division
      FROM 
        student s
      ORDER BY 
        s.branch, s.division, s.username
    `;

    const params: (string | number)[] = [];
    // If departmentId is needed, we need to join with a department table or filter by branch
    if (departmentId && departmentId !== "all") {
      // Since there's no direct department_id in the student table structure provided,
      // we'll map the branch to department if needed
      studentsQuery = `
        SELECT 
          s.id,
          s.username as name,
          s.email,
          s.branch,
          s.division
        FROM 
          student s
        WHERE 
          s.branch = (
            SELECT Department_Name 
            FROM department 
            WHERE Department_ID = ?
          )
        ORDER BY 
          s.division, s.username
      `;
      params.push(parseInt(departmentId, 10));
    }

    const studentsData = (await query(
      studentsQuery,
      params
    )) as RowDataPacket[];

    if (
      !studentsData ||
      !Array.isArray(studentsData) ||
      studentsData.length === 0
    ) {
      doc.setFontSize(12);
      doc.setTextColor(255, 0, 0);
      doc.text("No student data found", 14, contentStartY + 10);
    } else {
      // Create enhanced table data with Sr. No
      const tableData = studentsData.map((student, index) => [
        (index + 1).toString(), // Sr. No
        student.name || "N/A",
        student.email || "N/A",
        student.branch || "N/A",
        student.division || "N/A",
      ]) as RowInput[];

      // Add student listing table with enhanced styling
      autoTable(doc, {
        head: [["Sr. No", "Student Name", "Email", "Branch", "Division"]],
        body: tableData,
        startY: contentStartY,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          halign: "center",
        },
        styles: {
          overflow: "linebreak",
          cellWidth: "auto",
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 15 }, // Sr. No
          1: { cellWidth: 50 }, // Student Name
          2: { cellWidth: 60 }, // Email
          3: { cellWidth: 35 }, // Branch
          4: { cellWidth: 25 }, // Division
        },
      });

      // Add statistics section
      const finalY = (doc as any).lastAutoTable.finalY || contentStartY + 100;

      // Add new page for statistics if needed
      if (finalY > 200) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Student Statistics by Branch", 14, 20);
      } else {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Student Statistics by Branch", 14, finalY + 20);
      }

      // Get branch-wise student statistics
      const branchStatsQuery = `
        SELECT 
          branch,
          COUNT(id) as total_students
        FROM 
          student
        GROUP BY 
          branch
        ORDER BY 
          branch
      `;

      const branchStatsData = (await query(
        branchStatsQuery,
        []
      )) as RowDataPacket[];

      if (
        branchStatsData &&
        Array.isArray(branchStatsData) &&
        branchStatsData.length > 0
      ) {
        // Branch distribution
        const statsTableData = branchStatsData.map((stat) => [
          stat.branch || "N/A",
          stat.total_students?.toString() || "0",
        ]) as RowInput[];

        autoTable(doc, {
          head: [["Branch", "Total Students"]],
          body: statsTableData,
          startY: finalY > 200 ? 30 : finalY + 30,
          theme: "grid",
          headStyles: {
            fillColor: [240, 240, 240],
            textColor: 0,
            fontStyle: "bold",
            halign: "center",
          },
          bodyStyles: {
            halign: "center",
          },
        });
      }

      // Division-wise distribution
      const divisionStartY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Student Statistics by Division", 14, divisionStartY);

      const divisionStatsQuery = `
        SELECT 
          division,
          COUNT(id) as count
        FROM 
          student
        GROUP BY 
          division
        ORDER BY 
          division
      `;

      const divisionStatsData = (await query(
        divisionStatsQuery,
        []
      )) as RowDataPacket[];

      if (
        divisionStatsData &&
        Array.isArray(divisionStatsData) &&
        divisionStatsData.length > 0
      ) {
        const divisionTableData = divisionStatsData.map((stat) => [
          stat.division || "N/A",
          stat.count?.toString() || "0",
        ]) as RowInput[];

        autoTable(doc, {
          head: [["Division", "Number of Students"]],
          body: divisionTableData,
          startY: divisionStartY + 10,
          theme: "grid",
          headStyles: {
            fillColor: [240, 240, 240],
            textColor: 0,
            fontStyle: "bold",
            halign: "center",
          },
          bodyStyles: {
            halign: "center",
          },
        });
      }

      // Add signature section
      const signatureSectionY =
        (doc as any).lastAutoTable.finalY || finalY + 50;

      // Get actual faculty data for signature
      const facultyData = await getFacultyForSignature(departmentName);

      addSignatureSection(
        doc,
        signatureSectionY,
        facultyData.facultyName,
        departmentName,
        facultyData.signatureUrl
      );
    }
  } catch (error) {
    console.error("Error generating student report:", error);
    doc.setFontSize(12);
    doc.setTextColor(255, 0, 0);
    doc.text("Error: Could not fetch student data", 14, contentStartY + 10);
    doc.text(
      error instanceof Error ? error.message : "Unknown error",
      14,
      contentStartY + 20
    );
  }

  // Add footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    const pageWidth = doc.internal.pageSize.width;
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  return [doc, filename];
} // Helper function to generate research report
// Helper function to generate research report
async function generateResearchReport(
  departmentId?: string
): Promise<[jsPDF, string]> {
  const doc = new jsPDF();
  const filename = `research_report_${departmentId || "all"}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;

  // Get department name for display
  let departmentName = "All Departments";
  if (departmentId && departmentId !== "all") {
    try {
      const deptQuery = `SELECT Department_Name FROM department WHERE Department_ID = ?`;
      const deptResult = (await query(deptQuery, [
        parseInt(departmentId, 10),
      ])) as RowDataPacket[];
      if (deptResult && deptResult.length > 0) {
        departmentName = deptResult[0].Department_Name;
      }
    } catch (error) {
      console.error("Error fetching department name:", error);
    }
  }

  // Add institutional letterhead with dynamic title
  const contentStartY = await addInstitutionalLetterhead(
    doc,
    "Research Output and Consultancy Report",
    departmentName
  );

  try {
    // Fetch research data from research_project_consultancies table
    let researchQuery = `
      SELECT 
        r.id,
        r.Academic_year,
        r.Type_Research_Project_Consultancy as Type,
        r.Branch,
        r.Name_Of_Project_Endownment as Title,
        r.Name_Of_Principal_Investigator_CoInvestigator as Investigators,
        r.Department_Of_Principal_Investigator as Department,
        r.Year_Of_Award,
        r.Amount_Sanctioned,
        r.Duration_Of_The_Project as Duration,
        r.Name_Of_The_Funding_Agency as Funding_Agency,
        r.Type_Govt_NonGovt
      FROM 
        research_project_consultancies r
    `;

    const params: (string | number)[] = [];
    if (departmentId && departmentId !== "all") {
      researchQuery +=
        " WHERE r.Branch = (SELECT Department_Name FROM department WHERE Department_ID = ?)";
      params.push(parseInt(departmentId, 10));
    }

    researchQuery +=
      " ORDER BY r.Academic_year DESC, r.Branch, r.Name_Of_Project_Endownment";

    const researchData = (await query(
      researchQuery,
      params
    )) as RowDataPacket[];

    if (
      !researchData ||
      !Array.isArray(researchData) ||
      researchData.length === 0
    ) {
      doc.setFontSize(12);
      doc.setTextColor(255, 0, 0);
      doc.text("No research data found", 14, contentStartY + 10);
      return [doc, filename];
    }

    // Create enhanced table data with Sr. No
    const tableData = researchData.map((item, index) => [
      (index + 1).toString(), // Sr. No
      item.Title || "N/A",
      item.Investigators || "N/A",
      item.Department || "N/A",
      item.Type || "N/A",
      item.Year_Of_Award || "N/A",
      item.Funding_Agency || "N/A",
      item.Amount_Sanctioned || "N/A",
    ]) as RowInput[];

    // Add main data table with enhanced styling
    autoTable(doc, {
      head: [
        [
          "Sr. No",
          "Project Title",
          "Investigators",
          "Department",
          "Type",
          "Year",
          "Funding Agency",
          "Amount",
        ],
      ],
      body: tableData,
      startY: contentStartY,
      theme: "grid",
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: 0,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        halign: "center",
      },
      styles: {
        overflow: "linebreak",
        cellWidth: "auto",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 12 }, // Sr. No
        1: { cellWidth: 45 }, // Title column wider
        2: { cellWidth: 35 }, // Investigators column
        3: { cellWidth: 25 }, // Department
        4: { cellWidth: 20 }, // Type
        5: { cellWidth: 15 }, // Year
        6: { cellWidth: 30 }, // Funding agency
        7: { cellWidth: 25 }, // Amount
      },
    });

    // Add department-wise research statistics
    doc.addPage();

    // Add letterhead to new page
    const statsStartY = await addInstitutionalLetterhead(
      doc,
      "Research Statistics Summary",
      departmentName
    );

    // Fetch department-wise statistics
    const statsQuery = `
      SELECT 
        Branch AS Department,
        COUNT(*) AS TotalProjects,
        SUM(CASE WHEN Type_Research_Project_Consultancy = 'Research Project' THEN 1 ELSE 0 END) AS ResearchProjects,
        SUM(CASE WHEN Type_Research_Project_Consultancy = 'Consultancy' THEN 1 ELSE 0 END) AS Consultancies,
        SUM(CASE WHEN Type_Govt_NonGovt = 'Govt' THEN 1 ELSE 0 END) AS GovernmentFunded,
        SUM(CASE WHEN Type_Govt_NonGovt = 'NonGovt' THEN 1 ELSE 0 END) AS NonGovernmentFunded
      FROM 
        research_project_consultancies
      ${
        departmentId && departmentId !== "all"
          ? "WHERE Branch = (SELECT Department_Name FROM department WHERE Department_ID = ?)"
          : ""
      }
      GROUP BY 
        Branch
      ORDER BY 
        Branch
    `;

    const statsParams =
      departmentId && departmentId !== "all"
        ? [parseInt(departmentId, 10)]
        : [];
    const statsData = (await query(statsQuery, statsParams)) as RowDataPacket[];

    if (statsData && Array.isArray(statsData) && statsData.length > 0) {
      const statsTableData = statsData.map((stat) => [
        stat.Department || "N/A",
        stat.TotalProjects?.toString() || "0",
        stat.ResearchProjects?.toString() || "0",
        stat.Consultancies?.toString() || "0",
        stat.GovernmentFunded?.toString() || "0",
        stat.NonGovernmentFunded?.toString() || "0",
      ]) as RowInput[];

      autoTable(doc, {
        head: [
          [
            "Department",
            "Total Projects",
            "Research Projects",
            "Consultancies",
            "Govt Funded",
            "Non-Govt Funded",
          ],
        ],
        body: statsTableData,
        startY: statsStartY,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          halign: "center",
        },
      });
    }

    // Add funding agency distribution
    const fundingQuery = `
      SELECT 
        Name_Of_The_Funding_Agency as Agency,
        COUNT(*) as ProjectCount,
        SUM(CAST(REPLACE(REPLACE(Amount_Sanctioned, ',', ''), 'Rs. ', '') AS DECIMAL(15,2))) as TotalAmount
      FROM 
        research_project_consultancies
      ${
        departmentId && departmentId !== "all"
          ? "WHERE Branch = (SELECT Department_Name FROM department WHERE Department_ID = ?)"
          : ""
      }
      GROUP BY 
        Name_Of_The_Funding_Agency
      ORDER BY 
        ProjectCount DESC
      LIMIT 10
    `;

    const fundingParams =
      departmentId && departmentId !== "all"
        ? [parseInt(departmentId, 10)]
        : [];
    const fundingData = (await query(
      fundingQuery,
      fundingParams
    )) as RowDataPacket[];

    if (fundingData && Array.isArray(fundingData) && fundingData.length > 0) {
      const fundingStartY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Funding Agencies", 14, fundingStartY);

      const fundingTableData = fundingData.map((item) => [
        item.Agency || "N/A",
        item.ProjectCount?.toString() || "0",
        item.TotalAmount
          ? `Rs. ${item.TotalAmount.toLocaleString("en-IN")}`
          : "N/A",
      ]) as RowInput[];

      autoTable(doc, {
        head: [["Funding Agency", "Project Count", "Total Amount Sanctioned"]],
        body: fundingTableData,
        startY: fundingStartY + 10,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          halign: "center",
        },
      });
    }

    // Add signature section
    const signatureSectionY =
      (doc as any).lastAutoTable.finalY || statsStartY + 50;

    // Get actual faculty data for signature
    const facultyData = await getFacultyForSignature(departmentName);

    addSignatureSection(
      doc,
      signatureSectionY,
      facultyData.facultyName,
      departmentName,
      facultyData.signatureUrl
    );
  } catch (error) {
    console.error("Error generating research report:", error);
    doc.setFontSize(12);
    doc.setTextColor(255, 0, 0);
    doc.text("Error: Could not fetch research data", 14, contentStartY + 10);
    doc.text(
      error instanceof Error ? error.message : "Unknown error",
      14,
      contentStartY + 20
    );
  }

  // Add footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    const pageWidth = doc.internal.pageSize.width;
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  return [doc, filename];
}

// Helper function to generate full report
// Helper function to generate full report
async function generateFullReport(
  departmentId?: string
): Promise<[jsPDF, string]> {
  const doc = new jsPDF();
  const filename = `full_report_${departmentId || "all"}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;

  // Get department name for display
  let departmentName = "All Departments";
  if (departmentId && departmentId !== "all") {
    try {
      const deptQuery = `SELECT Department_Name FROM department WHERE Department_ID = ?`;
      const deptResult = (await query(deptQuery, [
        parseInt(departmentId, 10),
      ])) as RowDataPacket[];
      if (deptResult && deptResult.length > 0) {
        departmentName = deptResult[0].Department_Name;
      }
    } catch (error) {
      console.error("Error fetching department name:", error);
    }
  }

  // Cover page with institutional letterhead
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Add proper institutional letterhead to cover page
  const coverContentY = await addInstitutionalLetterhead(
    doc,
    "Comprehensive Academic Report",
    departmentName
  );

  // Additional cover page content
  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.text(`Department: ${departmentName}`, pageWidth / 2, coverContentY + 20, {
    align: "center",
  });

  doc.setFontSize(12);
  doc.text(
    "This comprehensive report contains detailed statistics about faculty,",
    pageWidth / 2,
    coverContentY + 60,
    { align: "center" }
  );
  doc.text(
    "students, research output, and academic accreditation metrics.",
    pageWidth / 2,
    coverContentY + 70,
    { align: "center" }
  );

  // Add NAAC and NBA section
  doc.addPage();

  // Add letterhead to NAAC page
  let contentStartY = await addInstitutionalLetterhead(
    doc,
    "NAAC Accreditation Statistics",
    departmentName
  );

  // Fetch NAAC statistics
  try {
    const naacQuery = `
      SELECT 
        criteria,
        score,
        max_score,
        year
      FROM 
        naac_statistics
      ORDER BY 
        year DESC, criteria ASC
    `;

    const naacData = (await query(naacQuery, [])) as RowDataPacket[];

    if (naacData && Array.isArray(naacData) && naacData.length > 0) {
      const naacTableData = naacData.map((item) => [
        item.criteria || "N/A",
        item.score?.toString() || "0",
        item.max_score?.toString() || "0",
        ((item.score / item.max_score) * 100).toFixed(2) + "%",
        item.year || "N/A",
      ]) as RowInput[];

      autoTable(doc, {
        head: [["Criteria", "Score", "Max Score", "Percentage", "Year"]],
        body: naacTableData,
        startY: contentStartY,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          halign: "center",
        },
      });
    } else {
      doc.setFontSize(12);
      doc.text("No NAAC statistics data available", 14, contentStartY + 10);
    }
  } catch (error) {
    console.error("Error fetching NAAC data:", error);
    doc.setFontSize(12);
    doc.text("Error fetching NAAC statistics", 14, contentStartY + 10);
  }

  // NBA Statistics section
  doc.addPage();
  contentStartY = await addInstitutionalLetterhead(
    doc,
    "NBA Accreditation Statistics",
    departmentName
  );

  // Fetch NBA statistics
  try {
    const nbaQuery = `
      SELECT 
        program,
        status,
        validity,
        year
      FROM 
        nba_statistics
      ORDER BY 
        year DESC, program ASC
    `;

    const nbaData = (await query(nbaQuery, [])) as RowDataPacket[];

    if (nbaData && Array.isArray(nbaData) && nbaData.length > 0) {
      const nbaTableData = nbaData.map((item) => [
        item.program || "N/A",
        item.status || "N/A",
        item.validity || "N/A",
        item.year || "N/A",
      ]) as RowInput[];

      autoTable(doc, {
        head: [["Program", "Status", "Validity", "Year"]],
        body: nbaTableData,
        startY: contentStartY,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          halign: "center",
        },
      });
    } else {
      doc.setFontSize(12);
      doc.text("No NBA statistics data available", 14, contentStartY + 10);

      // If no data in table, provide sample/default data for demonstration
      const sampleNbaData = [
        ["Computer Science Engineering", "Accredited", "2023-2026", "2023"],
        ["Electronics Engineering", "Accredited", "2022-2025", "2022"],
        ["Mechanical Engineering", "Provisional", "2023-2024", "2023"],
        ["Civil Engineering", "Applied", "Pending", "2023"],
      ];

      autoTable(doc, {
        head: [["Program", "Status", "Validity", "Year"]],
        body: sampleNbaData,
        startY: contentStartY + 20,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          halign: "center",
        },
      });

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        "* Sample data shown for demonstration purposes",
        14,
        (doc as any).lastAutoTable.finalY + 10
      );
    }
  } catch (error) {
    console.error("Error fetching NBA data:", error);
    doc.setFontSize(12);
    doc.text("Error fetching NBA statistics", 14, contentStartY + 10);
  }

  // Faculty statistics page
  doc.addPage();
  contentStartY = await addInstitutionalLetterhead(
    doc,
    "Faculty Distribution Statistics",
    departmentName
  );

  try {
    // Faculty designation distribution
    const facultyQuery = `
      SELECT 
        Current_Designation,
        COUNT(*) as count
      FROM 
        faculty_details
      GROUP BY 
        Current_Designation
      ORDER BY 
        count DESC
    `;

    const facultyData = (await query(facultyQuery, [])) as RowDataPacket[];

    if (facultyData && Array.isArray(facultyData) && facultyData.length > 0) {
      const facultyTableData = facultyData.map((item) => [
        item.Current_Designation || "Not Specified",
        item.count?.toString() || "0",
      ]) as RowInput[];

      autoTable(doc, {
        head: [["Designation", "Count"]],
        body: facultyTableData,
        startY: contentStartY,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          halign: "center",
        },
      });
    }
  } catch (error) {
    console.error("Error fetching faculty data:", error);
  }

  // Summary sections - Add references to detailed reports
  doc.addPage();
  contentStartY = await addInstitutionalLetterhead(
    doc,
    "Report Summary and References",
    departmentName
  );

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  doc.text(
    "This comprehensive report includes the following sections:",
    14,
    contentStartY + 10
  );
  doc.text("• NAAC Accreditation Statistics", 14, contentStartY + 25);
  doc.text("• NBA Accreditation Status", 14, contentStartY + 35);
  doc.text("• Faculty Distribution Statistics", 14, contentStartY + 45);

  doc.text(
    "For detailed information, please refer to individual reports:",
    14,
    contentStartY + 65
  );
  doc.text(
    "• Faculty Report: Complete faculty details and activities",
    14,
    contentStartY + 80
  );
  doc.text(
    "• Student Report: Student enrollment and distribution",
    14,
    contentStartY + 90
  );
  doc.text(
    "• Research Report: Research projects and consultancy details",
    14,
    contentStartY + 100
  );

  // Add signature section to summary page
  // Get actual faculty data for signature
  const facultyData = await getFacultyForSignature(departmentName);

  addSignatureSection(
    doc,
    contentStartY + 120,
    facultyData.facultyName,
    departmentName,
    facultyData.signatureUrl
  );

  // Add footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    const pageWidth = doc.internal.pageSize.width;
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  return [doc, filename];
}

// Mock download endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reportId = searchParams.get("id");

  if (!reportId) {
    return NextResponse.json(
      { success: false, message: "Report ID is required" },
      { status: 400 }
    );
  }

  try {
    // In a real implementation, we would:
    // 1. Look up the report in a database or file storage
    // 2. Generate or retrieve the actual PDF file
    // 3. Return it with appropriate headers

    // For this example, generate a simple PDF on-the-fly
    const [doc, filename] = await generateFacultyReport();
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
