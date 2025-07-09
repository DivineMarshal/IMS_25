"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/app/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EnhancedReportPreview } from "@/app/components/ui/enhanced-report-preview";
import {
  UserIcon,
  EnvelopeIcon,
  AcademicCapIcon,
  CalendarIcon,
  ClockIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  UsersIcon,
  KeyIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";

// Helper function to format dates
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
};

interface FacultyAchievement {
  id: number;
  title: string;
  description: string;
  date: string;
}

interface Publication {
  id: number;
  title: string;
  journal: string;
  year: number;
  url?: string;
}

interface ProfileData {
  id: string | number;
  username: string;
  email: string;
  name?: string;
  role: string;
  department?: number | string;
  departmentName?: string;
  designation?: string;
  employeeId?: string;
  qualification?: string;
  experience?: number;
  joinDate?: string;
  lastLogin?: string;
  profileImage?: string;
  achievements?: FacultyAchievement[];
  publications?: Publication[];
  researchProjects?: number;
  professionalMemberships?: number;
  totalContributions?: number;
  enrollmentNo?: string;
  semester?: number;
  program?: string;
  studentId?: number;
  facultyId?: number;
  phone?: string;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<string>("basic");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [biodataLoading, setBiodataLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportData, setReportData] = useState<{
    pdfBase64?: string;
    filename?: string;
  }>({});
  const router = useRouter();
  // Function to generate faculty comprehensive report
  const handleGenerateComprehensiveReport = async () => {
    if (!profile || !profile.facultyId) return;

    try {
      setBiodataLoading(true);

      const response = await fetch(
        `/api/faculty/comprehensive-report?facultyId=${profile.facultyId}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to generate comprehensive report"
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message || "Failed to generate comprehensive report"
        );
      }

      // Store PDF data for preview
      setReportData({
        pdfBase64: data.data.pdfBase64,
        filename: data.data.filename,
      });

      // Show PDF preview
      setPreviewOpen(true);
    } catch (error) {
      console.error("Error generating comprehensive report:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate comprehensive report"
      );
    } finally {
      setBiodataLoading(false);
    }
  };

  // Function to generate faculty biodata
  const handleGenerateBiodata = async () => {
    if (!profile || !profile.facultyId) return;

    try {
      setBiodataLoading(true);

      // First, make sure necessary tables exist
      try {
        await fetch(`/api/faculty/biodata/setup`);
      } catch (setupError) {
        console.warn("Setup endpoint error:", setupError);
        // Continue anyway, the main endpoint will handle errors
      }

      // Now generate the biodata
      const response = await fetch(
        `/api/faculty/biodata?facultyId=${profile.facultyId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to generate biodata: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to generate biodata");
      }

      setReportData({
        pdfBase64: result.data.pdfBase64,
        filename: result.data.filename,
      });
      setPreviewOpen(true);
    } catch (err) {
      console.error("Error generating biodata:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while generating biodata"
      );
    } finally {
      setBiodataLoading(false);
    }
  };

  // Fetch profile data from the API
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/profile");

        if (!response.ok) {
          throw new Error(`Failed to fetch profile: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.profile) {
          setProfile(data.profile);
          setError(null);
        } else {
          throw new Error(data.message || "Failed to load profile data");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching your profile"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <MainLayout>
        <div className="animate-pulse space-y-6 p-6">
          <div className="h-8 w-1/4 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-100 rounded-lg shadow"></div>
            <div className="h-64 md:col-span-2 bg-gray-100 rounded-lg shadow"></div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start space-x-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mt-0.5" />
            <div>
              <h2 className="text-lg font-medium text-red-800">
                Failed to load profile
              </h2>
              <p className="text-sm text-red-600 mt-1">
                {error || "Could not retrieve your profile information"}
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-0">
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-6">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl mb-4">
                {profile?.profileImage ? (
                  <img
                    src={profile.profileImage}
                    alt={profile.name || profile.username}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span>
                    {profile?.name?.charAt(0) ||
                      profile?.username?.charAt(0) ||
                      "U"}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold mb-1">
                {profile?.name || profile?.username}
              </h2>
              <p className="text-sm text-gray-500 mb-1 capitalize">
                {profile?.role}
              </p>
              {profile?.designation && (
                <p className="text-sm text-indigo-600 font-medium">
                  {profile.designation}
                </p>
              )}{" "}
              <div className="w-full border-t border-gray-200 pt-4 mt-4 space-y-2">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => router.push("/profile/edit")}
                >
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* User Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>User Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={currentTab}
                onValueChange={setCurrentTab}
                className="space-y-4"
              >
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  {(profile?.role === "faculty" || profile?.role === "hod") && (
                    <TabsTrigger value="academic">Academic Info</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="basic">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <UserIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Username / ID</p>
                        <p className="font-medium">{profile?.username}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <EnvelopeIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{profile?.email}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <BuildingOfficeIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Department</p>
                        <p className="font-medium">
                          {profile?.departmentName || "Not assigned"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <AcademicCapIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Role</p>
                        <p className="font-medium capitalize">
                          {profile?.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CalendarIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Joined On</p>
                        <p className="font-medium">
                          {formatDate(profile?.joinDate)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <ClockIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Last Login</p>
                        <p className="font-medium">
                          {formatDate(profile?.lastLogin) || "First login"}
                        </p>
                      </div>
                    </div>

                    {/* Show enrollment number for students */}
                    {profile?.role === "student" && profile?.enrollmentNo && (
                      <div className="flex items-start gap-3">
                        <UserIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Enrollment No</p>
                          <p className="font-medium">{profile.enrollmentNo}</p>
                        </div>
                      </div>
                    )}

                    {/* Show semester and program for students */}
                    {profile?.role === "student" && profile?.semester && (
                      <div className="flex items-start gap-3">
                        <AcademicCapIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Semester</p>
                          <p className="font-medium">{profile.semester}</p>
                        </div>
                      </div>
                    )}

                    {profile?.role === "student" && profile?.program && (
                      <div className="flex items-start gap-3">
                        <AcademicCapIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Program</p>
                          <p className="font-medium">{profile.program}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {(profile?.role === "faculty" || profile?.role === "hod") && (
                  <TabsContent value="academic">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile?.designation && (
                        <div className="flex items-start gap-3">
                          <BriefcaseIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Designation</p>
                            <p className="font-medium">{profile.designation}</p>
                          </div>
                        </div>
                      )}

                      {profile?.qualification && (
                        <div className="flex items-start gap-3">
                          <AcademicCapIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Highest Qualification
                            </p>
                            <p className="font-medium">
                              {profile.qualification}
                            </p>
                          </div>
                        </div>
                      )}

                      {profile?.experience !== undefined && (
                        <div className="flex items-start gap-3">
                          <BriefcaseIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Teaching Experience
                            </p>
                            <p className="font-medium">
                              {profile.experience} years
                            </p>
                          </div>
                        </div>
                      )}

                      {profile?.phone && (
                        <div className="flex items-start gap-3">
                          <EnvelopeIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Contact Number
                            </p>
                            <p className="font-medium">{profile.phone}</p>
                          </div>
                        </div>
                      )}

                      {profile?.publications && (
                        <div className="flex items-start gap-3">
                          <DocumentTextIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Publications
                            </p>
                            <p className="font-medium">
                              {profile.publications.length}
                            </p>
                          </div>
                        </div>
                      )}

                      {profile?.researchProjects !== undefined && (
                        <div className="flex items-start gap-3">
                          <DocumentTextIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Research Projects
                            </p>
                            <p className="font-medium">
                              {profile.researchProjects}
                            </p>
                          </div>
                        </div>
                      )}

                      {profile?.professionalMemberships !== undefined && (
                        <div className="flex items-start gap-3">
                          <UsersIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Professional Memberships
                            </p>
                            <p className="font-medium">
                              {profile.professionalMemberships}
                            </p>
                          </div>
                        </div>
                      )}

                      {profile?.totalContributions !== undefined && (
                        <div className="flex items-start gap-3">
                          <DocumentTextIcon className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">
                              Total Contributions
                            </p>
                            <p className="font-medium">
                              {profile.totalContributions}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                )}
              </Tabs>{" "}
              <div className="pt-4 mt-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-2 justify-between">
                  <Button
                    onClick={() => router.push("/profile/change-password")}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <KeyIcon className="h-4 w-4" />
                    Change Password
                  </Button>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {(profile?.role === "faculty" ||
                      profile?.role === "hod") && (
                      <Button
                        onClick={handleGenerateComprehensiveReport}
                        variant="default"
                        className="flex items-center gap-2"
                        disabled={biodataLoading}
                      >
                        <DocumentArrowDownIcon className="h-4 w-4" />
                        {biodataLoading
                          ? "Generating..."
                          : "Comprehensive Report"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          {profile?.achievements && profile.achievements.length > 0 && (
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrophyIcon className="h-5 w-5 mr-2 text-yellow-500" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profile.achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium">{achievement.title}</h3>
                        <span className="text-sm text-gray-500">
                          {formatDate(achievement.date)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {/* Remove year in parentheses at end of description */}
                        {achievement.description.replace(/\s*\(\d{4}\)$/, "")}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Publications for faculty */}
          {profile?.publications && profile.publications.length > 0 && (
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-blue-500" />
                  Publications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profile.publications.map((pub) => (
                    <div
                      key={pub.id}
                      className="p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium">{pub.title}</h3>
                        <span className="text-sm text-gray-500">
                          {pub.year}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {pub.journal}
                      </p>
                      {pub.url && (
                        <a
                          href={pub.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                        >
                          View Publication
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>{" "}
      {/* Report Preview Dialog */}
      <EnhancedReportPreview
        isOpen={previewOpen}
        onClose={() => {
          try {
            setPreviewOpen(false);
          } catch (error) {
            console.error("Error closing report preview:", error);
          }
        }}
        pdfBase64={reportData.pdfBase64}
        filename={reportData.filename}
        title="Faculty CV/Biodata"
      />
    </MainLayout>
  );
}
