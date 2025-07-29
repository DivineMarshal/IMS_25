/**
 * Central configuration for department names and their abbreviations
 * This is the single source of truth for department names
 */

// Basic department information
export const departments = [
  {
    id: 10,
    name: "Computer Engineering",
    abbreviation: "CE",
    code: "CE-101",
    facultyIdPrefix: 1,
    studentIdPrefix: 10000,
  },
  {
    id: 20,
    name: "Mechanical Engineering",
    abbreviation: "ME",
    code: "ME-102",
    facultyIdPrefix: 2,
    studentIdPrefix: 20000,
  },
  {
    id: 30,
    name: "Electronics and Telecommunication Engineering",
    abbreviation: "ExTC",
    code: "ExTC-103",
    facultyIdPrefix: 3,
    studentIdPrefix: 30000,
  },
  {
    id: 40,
    name: "Electrical Engineering",
    abbreviation: "EE",
    code: "EE-104",
    facultyIdPrefix: 4,
    studentIdPrefix: 40000,
  },
  {
    id: 50,
    name: "Information Technology",
    abbreviation: "IT",
    code: "IT-105",
    facultyIdPrefix: 5,
    studentIdPrefix: 50000,
  },
];

// Helper functions

/**
 * Get department information by ID
 */
export function getDepartmentById(id: number) {
  return departments.find((dept) => dept.id === id);
}

/**
 * Get department information by name
 */
export function getDepartmentByName(name: string) {
  return departments.find((dept) => dept.name === name);
}

/**
 * Get department information by abbreviation
 */
export function getDepartmentByAbbreviation(abbreviation: string) {
  return departments.find((dept) => dept.abbreviation === abbreviation);
}

/**
 * Convert department name to abbreviation
 */
export function getAbbreviation(name: string): string {
  const department = getDepartmentByName(name);
  return department ? department.abbreviation : name;
}

/**
 * Convert abbreviation to full department name
 */
export function getFullName(abbreviation: string): string {
  const department = getDepartmentByAbbreviation(abbreviation);
  return department ? department.name : abbreviation;
}

/**
 * Get the faculty ID range for a department
 */
export function getFacultyIdRange(departmentId: number) {
  const department = getDepartmentById(departmentId);
  if (!department) return null;

  return {
    min: department.facultyIdPrefix + 1,
    max: department.facultyIdPrefix + 99,
  };
}

/**
 * Get the student ID range for a department
 */
export function getStudentIdRange(departmentId: number) {
  const department = getDepartmentById(departmentId);
  if (!department) return null;

  return {
    min: department.studentIdPrefix + 1,
    max: department.studentIdPrefix + 9999,
  };
}

/**
 * Get department ID from faculty ID
 */
export function getDepartmentIdFromFacultyId(facultyId: number): number | null {
  const prefix = Math.floor(facultyId / 100) * 100;
  const department = departments.find(
    (dept) => dept.facultyIdPrefix === prefix
  );
  return department ? department.id : null;
}

/**
 * Get department ID from student ID
 */
export function getDepartmentIdFromStudentId(studentId: number): number | null {
  const prefix = Math.floor(studentId / 10000) * 10000;
  const department = departments.find(
    (dept) => dept.studentIdPrefix === prefix
  );
  return department ? department.id : null;
}
