import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { RowDataPacket } from "mysql2";
import { RowInput, UserOptions } from "jspdf-autotable";

// Extend jsPDF with autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: UserOptions) => jsPDF;
  }
}

interface FacultyProfile {
  F_id: string;
  F_name: string;
  F_dept: string;
  Email: string | null;
  Phone_Number: string | null; // Changed from Phone_No to Phone_Number to match DB schema
  Current_Designation: string | null;
  Highest_Degree: string | null;
  Experience: number | null;
  Date_of_Joining: string | null;
  Research_Interest: string | null;
  Bio: string | null;
}

interface Publication {
  id: number;
  title: string;
  abstract: string | null;
  authors: string;
  publication_date: string;
  publication_type:
    | "journal"
    | "conference"
    | "book"
    | "book_chapter"
    | "other";
  publication_venue: string;
  doi: string | null;
  url: string | null;
  citation_count: number | null;
}

interface Award {
  award_id: number;
  award_name: string;
  awarding_organization: string;
  award_date: string;
  award_description: string | null;
}

interface Contribution {
  contribution_id: number;
  contribution_type: string;
  contribution_title: string;
  contribution_date: string;
  year: number | null;
  journal_conference: string | null;
  award: string | null;
  impact_factor: string | null;
  description: string | null;
}

interface Membership {
  membership_id: number;
  organization: string;
  membership_type: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // Extract faculty ID from query parameters
    const facultyId = request.nextUrl.searchParams.get("facultyId");

    if (!facultyId) {
      return NextResponse.json(
        { success: false, message: "Faculty ID is required" },
        { status: 400 }
      );
    }

    // 1. Get faculty profile information
    const faculty = await getFacultyProfile(facultyId);
    if (!faculty) {
      return NextResponse.json(
        { success: false, message: "Faculty not found" },
        { status: 404 }
      );
    }

    // 2. Get faculty publications
    const publications = await getPublications(facultyId);

    // 3. Get faculty awards
    const awards = await getAwards(facultyId);

    // 4. Get faculty contributions
    const contributions = await getContributions(facultyId);

    // 5. Get faculty memberships
    const memberships = await getMemberships(facultyId);

    // Generate the PDF document
    const [pdfDoc, filename] = await generateBiodata(
      faculty,
      publications,
      awards,
      contributions,
      memberships
    );

    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));

    // Encode as base64
    const base64PDF = pdfBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      message: "Biodata generated successfully",
      data: {
        facultyName: faculty.F_name,
        facultyId,
        generatedAt: new Date().toISOString(),
        filename,
        pdfBase64: base64PDF,
      },
    });
  } catch (error) {
    console.error("Error generating biodata:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to generate biodata",
      },
      { status: 500 }
    );
  }
}

async function getFacultyProfile(
  facultyId: string
): Promise<FacultyProfile | null> {
  const facultyQuery = `
    SELECT 
      f.F_id,
      f.F_name,
      IFNULL(f.F_dept, 'Not Specified') as F_dept,
      fd.Email,
      fd.Phone_Number,
      fd.Current_Designation,
      fd.Highest_Degree,
      fd.Experience,
      fd.Date_of_Joining,
      '' as Research_Interest,
      '' as Bio
    FROM 
      faculty f
    LEFT JOIN 
      faculty_details fd ON f.F_id = fd.F_ID
    WHERE 
      f.F_id = ?
  `;

  const result = (await query(facultyQuery, [facultyId])) as RowDataPacket[];

  if (!result || !Array.isArray(result) || result.length === 0) {
    return null;
  }

  // Ensure all fields have at least a default value to prevent null errors
  const profile = result[0] as FacultyProfile;
  return {
    F_id: profile.F_id,
    F_name: profile.F_name || "Unknown Faculty",
    F_dept: profile.F_dept || "Not Specified",
    Email: profile.Email || "Not Available",
    Phone_Number: profile.Phone_Number || "Not Available",
    Current_Designation: profile.Current_Designation || "Not Specified",
    Highest_Degree: profile.Highest_Degree || "Not Specified",
    Experience: profile.Experience || 0,
    Date_of_Joining: profile.Date_of_Joining || null,
    Research_Interest: profile.Research_Interest || "",
    Bio: profile.Bio || "",
  };
}

async function getPublications(facultyId: string): Promise<Publication[]> {
  // Check if faculty_contributions table exists and has entries
  try {
    const contributionsQuery = `
      SELECT 
        fc.Contribution_ID as id,
        '' as title,
        fc.Description as abstract,
        '' as authors,
        fc.Contribution_Date as publication_date,
        CASE 
          WHEN fc.Contribution_Type = 'journal' THEN 'journal'
          WHEN fc.Contribution_Type = 'conference' THEN 'conference'
          WHEN fc.Contribution_Type = 'book' THEN 'book'
          WHEN fc.Contribution_Type = 'book_chapter' THEN 'book_chapter'
          ELSE 'other'
        END as publication_type,
        fc.Recognized_By as publication_venue,
        fc.Award_Received as doi,
        '' as url,
        '' as citation_count
      FROM 
        faculty_contributions fc
      WHERE 
        fc.F_ID = ? AND fc.Contribution_Type IN ('journal', 'conference', 'publication', 'book', 'book_chapter')
      ORDER BY 
        fc.Contribution_Date DESC
    `;

    const result = (await query(contributionsQuery, [
      facultyId,
    ])) as RowDataPacket[];

    if (result && Array.isArray(result) && result.length > 0) {
      return result as Publication[];
    }
  } catch (error) {
    console.error("Error querying faculty_contributions:", error);
  }

  // If no results from faculty_contributions, try bookschapter table
  try {
    const bookschapterQuery = `
      SELECT 
        id as id,
        Title_Of_The_Book_Published as title,
        '' as abstract,
        Name_Of_The_Teacher as authors,
        STR_TO_DATE(CONCAT(Year_Of_Publication, '-01-01'), '%Y-%m-%d') as publication_date,
        CASE 
          WHEN National_Or_International = 'National' THEN 'book'
          WHEN National_Or_International = 'International' THEN 'book'
          ELSE 'book_chapter'
        END as publication_type,
        Name_Of_The_Publisher as publication_venue,
        ISBN_Or_ISSN_Number as doi,
        paper_link as url,
        '' as citation_count
      FROM 
        bookschapter
      WHERE 
        user_id = ? AND STATUS = 'approved'
      ORDER BY 
        Year_Of_Publication DESC
    `;

    const result = (await query(bookschapterQuery, [
      facultyId,
    ])) as RowDataPacket[];

    if (result && Array.isArray(result)) {
      return result as Publication[];
    }
  } catch (error) {
    console.error("Error querying bookschapter table:", error);
  }

  return [];
}

async function getAwards(facultyId: string): Promise<Award[]> {
  // Skip checking for faculty_awards table and directly use faculty_contributions
  // This avoids issues with tables or columns that don't exist

  const contributionsAwardsQuery = `
    SELECT 
      fc.Contribution_ID as award_id,
      fc.Description as award_name,
      fc.Recognized_By as awarding_organization,
      fc.Contribution_Date as award_date,
      fc.Remarks as award_description
    FROM 
      faculty_contributions fc
    WHERE 
      fc.F_ID = ? AND fc.Contribution_Type IN ('award', 'achievement')
    ORDER BY 
      fc.Contribution_Date DESC
  `;

  try {
    const result = (await query(contributionsAwardsQuery, [
      facultyId,
    ])) as RowDataPacket[];

    if (!result || !Array.isArray(result)) {
      return [];
    }

    return result as Award[];
  } catch (error) {
    console.error("Error fetching awards from faculty_contributions:", error);
    return [];
  }
}

async function getContributions(facultyId: string): Promise<Contribution[]> {
  const contributionsQuery = `
    SELECT 
      Contribution_ID as contribution_id,
      Contribution_Type as contribution_type,
      Contribution_Type as contribution_title, -- Use type as title
      Contribution_Date as contribution_date,
      YEAR(Contribution_Date) as year,
      Recognized_By as journal_conference,
      Award_Received as award,
      '' as impact_factor,
      Description as description -- Use Description as main text
    FROM 
      faculty_contributions
    WHERE 
      F_ID = ? AND Contribution_Type NOT IN ('award', 'achievement', 'journal', 'conference', 'publication', 'book', 'book_chapter')
    ORDER BY 
      Contribution_Date DESC
  `;

  const result = (await query(contributionsQuery, [
    facultyId,
  ])) as RowDataPacket[];

  if (!result || !Array.isArray(result)) {
    return [];
  }

  return result as Contribution[];
}

async function getMemberships(facultyId: string): Promise<Membership[]> {
  // Check if we're using faculty_professional_body table
  const professionalBodyQuery = `
    SELECT 
      SrNo as membership_id,
      Professional_Body_Name as organization,
      Membership_Type as membership_type,
      DATE_FORMAT(Year, '%Y-01-01') as start_date,
      NULL as end_date,
      Membership_Number as description
    FROM 
      faculty_professional_body
    WHERE 
      F_ID = ?
    ORDER BY 
      Year DESC
  `;

  let result;
  try {
    result = (await query(professionalBodyQuery, [
      facultyId,
    ])) as RowDataPacket[];

    if (result && Array.isArray(result) && result.length > 0) {
      return result as Membership[];
    }
  } catch (error) {
    console.error(
      "Error fetching memberships from faculty_professional_body:",
      error
    );
  }

  // If no results, try workshops table
  try {
    const tableCheck = await query("SHOW TABLES LIKE 'faculty_workshops'");
    if (Array.isArray(tableCheck) && tableCheck.length > 0) {
      const workshopsQuery = `
        SELECT 
          id as membership_id,
          venue as organization,
          type as membership_type,
          start_date,
          end_date,
          description
        FROM 
          faculty_workshops
        WHERE 
          faculty_id = ?
        ORDER BY 
          start_date DESC
      `;

      result = (await query(workshopsQuery, [facultyId])) as RowDataPacket[];
    }
  } catch (error) {
    console.error("Error fetching from workshops table:", error);
  }
  if (!result || !Array.isArray(result)) {
    return [];
  }

  return result as Membership[];
}

async function generateBiodata(
  faculty: FacultyProfile,
  publications: Publication[],
  awards: Award[],
  contributions: Contribution[],
  memberships: Membership[]
): Promise<[jsPDF, string]> {
  const doc = new jsPDF();
  const filename = `faculty_biodata_${faculty.F_id}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;

  // Set title and document properties
  doc.setProperties({
    title: `Biodata of ${faculty.F_name}`,
    subject: `Faculty Biodata - ${faculty.F_dept}`,
    author: "IMS Hindavi 3 System",
    creator: "IMS Hindavi 3 System",
  });

  // Add header with faculty name and designation
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(faculty.F_name, doc.internal.pageSize.width / 2, 20, {
    align: "center",
  });

  if (faculty.Current_Designation) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(faculty.Current_Designation, doc.internal.pageSize.width / 2, 30, {
      align: "center",
    });
  }

  doc.setFontSize(12);
  doc.text(faculty.F_dept, doc.internal.pageSize.width / 2, 38, {
    align: "center",
  });

  let yPos = 50;

  // Contact Information
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Contact Information", 14, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  if (faculty.Email) {
    doc.text(`Email: ${faculty.Email}`, 14, yPos);
    yPos += 6;
  }

  if (faculty.Phone_Number) {
    doc.text(`Phone: ${faculty.Phone_Number}`, 14, yPos);
    yPos += 6;
  }

  // Academic Details
  yPos += 6;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Academic Information", 14, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  if (faculty.Highest_Degree) {
    doc.text(`Highest Qualification: ${faculty.Highest_Degree}`, 14, yPos);
    yPos += 6;
  }

  if (faculty.Experience) {
    doc.text(`Experience: ${faculty.Experience} years`, 14, yPos);
    yPos += 6;
  }

  if (faculty.Date_of_Joining) {
    const joinDate = new Date(faculty.Date_of_Joining);
    doc.text(
      `Date of Joining: ${joinDate.toLocaleDateString("en-IN")}`,
      14,
      yPos
    );
    yPos += 6;
  }
  // Research Interests - Commented out as this field is not yet in the database
  // If you add the Research_Interest column to faculty_details table, you can uncomment this
  /*
  if (faculty.Research_Interest && faculty.Research_Interest.trim() !== '') {
    yPos += 6;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Research Interests", 14, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const splitText = doc.splitTextToSize(faculty.Research_Interest, 180);
    doc.text(splitText, 14, yPos);
    yPos += splitText.length * 6 + 6;
  }
  */

  // Bio - Commented out as this field is not yet in the database
  // If you add the Bio column to faculty_details table, you can uncomment this
  /*
  if (faculty.Bio && faculty.Bio.trim() !== '') {
    yPos += 6;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Biography", 14, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const bioSplitText = doc.splitTextToSize(faculty.Bio, 180);
    doc.text(bioSplitText, 14, yPos);
    yPos += bioSplitText.length * 6 + 6;
  }
  */

  // Check if we need to add a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Publications
  if (publications.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Publications", doc.internal.pageSize.width / 2, yPos, {
      align: "center",
    });
    yPos += 10;

    // Group publications by type
    const journalPubs = publications.filter(
      (p) => p.publication_type === "journal"
    );
    const conferencePubs = publications.filter(
      (p) => p.publication_type === "conference"
    );
    const bookPubs = publications.filter(
      (p) =>
        p.publication_type === "book" || p.publication_type === "book_chapter"
    );
    const otherPubs = publications.filter(
      (p) => p.publication_type === "other"
    );

    let pubTypes = [
      { type: "Journal Articles", items: journalPubs },
      { type: "Conference Papers", items: conferencePubs },
      { type: "Books and Book Chapters", items: bookPubs },
      { type: "Other Publications", items: otherPubs },
    ];

    for (const pubType of pubTypes) {
      if (pubType.items.length > 0) {
        // Check if we need to add a new page
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(pubType.type, 14, yPos);
        yPos += 8;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");

        for (const pub of pubType.items) {
          const formattedDate = new Date(pub.publication_date).getFullYear();
          const citation = `${pub.authors} (${formattedDate}). ${pub.title}. ${pub.publication_venue}.`;

          const splitCitation = doc.splitTextToSize(citation, 180);

          // Check if we need a new page for this citation
          if (
            yPos + splitCitation.length * 5 + 10 >
            doc.internal.pageSize.height - 15
          ) {
            doc.addPage();
            yPos = 20;
          }

          doc.text(splitCitation, 14, yPos);
          yPos += splitCitation.length * 5;

          if (pub.doi) {
            doc.setTextColor(0, 0, 255);
            doc.text(`DOI: ${pub.doi}`, 14, yPos);
            doc.setTextColor(0, 0, 0);
          }
          yPos += 10;
        }

        yPos += 5;
      }
    }
  }

  // Awards and Honors
  if (awards.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Awards and Honors", doc.internal.pageSize.width / 2, yPos, {
      align: "center",
    });
    yPos += 15;

    const awardData = awards.map((award) => [
      award.award_name,
      award.awarding_organization,
      new Date(award.award_date).toLocaleDateString("en-IN"),
      award.award_description || "",
    ]) as RowInput[];

    autoTable(doc, {
      head: [["Award Name", "Organization", "Date", "Description"]],
      body: awardData,
      startY: yPos,
      theme: "grid",
      headStyles: { fillColor: [75, 70, 229], textColor: 255 },
      styles: { overflow: "linebreak", cellWidth: "auto" },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 70 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Professional Memberships
  if (memberships.length > 0) {
    // Check if we need to add a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    } else {
      yPos += 10;
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      "Professional Memberships",
      doc.internal.pageSize.width / 2,
      yPos,
      { align: "center" }
    );
    yPos += 15;

    const membershipData = memberships.map((m) => [
      m.organization,
      m.membership_type,
      new Date(m.start_date).toLocaleDateString("en-IN"),
      m.end_date ? new Date(m.end_date).toLocaleDateString("en-IN") : "Present",
      m.description || "",
    ]) as RowInput[];

    autoTable(doc, {
      head: [["Organization", "Type", "Start Date", "End Date", "Description"]],
      body: membershipData,
      startY: yPos,
      theme: "grid",
      headStyles: { fillColor: [75, 70, 229], textColor: 255 },
      styles: { overflow: "linebreak", cellWidth: "auto" },
    });
  } // Other Contributions
  if (contributions.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      "Other Academic Contributions",
      doc.internal.pageSize.width / 2,
      yPos,
      { align: "center" }
    );
    yPos += 15;

    // Group contributions by type
    const contributionsByType = contributions.reduce((acc, curr) => {
      const type = curr.contribution_type || "Other";
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(curr);
      return acc;
    }, {} as Record<string, Contribution[]>);

    for (const [type, items] of Object.entries(contributionsByType)) {
      // Skip if already included in publications
      if (
        ["journal", "conference", "book", "book_chapter"].includes(
          type.toLowerCase()
        )
      ) {
        continue;
      }

      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");

      // Capitalize first letter of type
      const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
      doc.text(formattedType, 14, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");

      for (const item of items) {
        // Heading: Contribution_Type (bold)
        const heading = item.contribution_type || "Contribution";
        const splitHeading = doc.splitTextToSize(heading, 180);

        // Check if we need a new page for this item
        if (
          yPos + splitHeading.length * 5 + 8 >
          doc.internal.pageSize.height - 15
        ) {
          doc.addPage();
          yPos = 20;
        }

        // Only print the heading once (bold)
        doc.setFont("helvetica", "bold");
        
       

        // Only print the description (normal)
        if (item.description) {
          doc.setFont("helvetica", "normal");
          const descText = doc.splitTextToSize(item.description, 170);
          doc.text(descText, 14, yPos);
          yPos += descText.length * 5;
        }

        yPos += 10;
      }

      yPos += 6;
    }
  } // Add footer with page numbers
  const pageCount = doc.internal.pages.length - 1;
  if (pageCount > 0) {
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );

      // Add generation date at the bottom of each page
      const today = new Date().toLocaleDateString("en-IN");
      doc.text(
        `Generated on: ${today}`,
        doc.internal.pageSize.width - 14,
        doc.internal.pageSize.height - 10,
        { align: "right" }
      );
    }
  } else {
    // Ensure we have at least one page
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      "No additional data available",
      doc.internal.pageSize.width / 2,
      100,
      {
        align: "center",
      }
    );

    // Add generation date at the bottom
    const today = new Date().toLocaleDateString("en-IN");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated on: ${today}`,
      doc.internal.pageSize.width - 14,
      doc.internal.pageSize.height - 10,
      { align: "right" }
    );
  }

  return [doc, filename];
}
