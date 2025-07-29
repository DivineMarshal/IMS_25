"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import React from "react";
import MainLayout from "@/app/components/layout/MainLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartmentForm } from "@/components/department/DepartmentForm";
import { useAuth } from "@/app/providers/auth-provider";
import { use } from "react";

interface DepartmentData {
  Department_ID: number;
  Department_Name: string;
  Establishment_Year: number | null;
  Department_Code: string;
  Email_ID: string;
  Department_Phone_Number: string;
  HOD_ID: number | null;
  Vision: string;
  Mission: string;
  Total_Faculty: number;
  Total_Students: number;
  Website_URL: string;
  Notable_Achievements: string;
  Industry_Collaboration: string;
  Research_Focus_Area: string;
  HOD: {
    id: number;
    name: string;
  } | null;
}

export default function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);
  const [departmentData, setDepartmentData] = useState<DepartmentData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const canEdit =
    user &&
    (user.role === "admin" ||
      ((user.role === "hod" || user.role === "department") &&
        user.departmentId === Number(id)));

  // Debug log for access control (after canEdit is defined)
  console.log(
    "[EditDepartmentPage] user:",
    user,
    "user.departmentId:",
    user?.departmentId,
    "id:",
    id,
    "typeof id:",
    typeof id,
    "canEdit:",
    canEdit
  );

  // Guard: Wait for user to be loaded
  if (user === undefined) {
    return null; // or a loading spinner if you prefer
  }

  useEffect(() => {
    if (!user) return; // Wait for user to load

    const fetchDepartmentData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/departments/${id}`);
        if (!response.ok) {
          // Try to get the error message
          let errorMsg = "Failed to fetch department data";
          try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
          } catch (e) {
            // If we can't parse the error, use the default message
          }
          throw new Error(errorMsg);
        }
        const data = await response.json();
        setDepartmentData(data);
      } catch (error) {
        console.error("Error fetching department data:", error);
        setError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
        toast.error("Failed to load department data");
      } finally {
        setLoading(false);
      }
    };

    fetchDepartmentData();
  }, [id, user]);

  const handleClose = () => {
    router.push("/departments");
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Edit Department</h1>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
            </div>

            <Card className="p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Edit Department</h1>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
            </div>

            <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
              <p className="text-red-600">{error}</p>
              <Button
                variant="outline"
                className="mt-4 text-red-600 border-red-300 hover:bg-red-50"
                onClick={handleClose}
              >
                Return to Department List
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Access control logic
  if (!canEdit) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-4">
            You do not have permission to edit this department.
          </p>
        </div>
      </MainLayout>
    );
  }

  if (!departmentData) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Edit Department</h1>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
              <p className="text-red-500">
                Department not found or data is incomplete
              </p>
              <Button variant="outline" onClick={handleClose} className="mt-4">
                Return to Department List
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">
              Edit Department: {departmentData.Department_Name}
            </h1>
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </div>

          <DepartmentForm
            onClose={handleClose}
            initialData={departmentData}
            isEditing={true}
            departmentId={parseInt(id)}
          />
        </div>
      </div>
    </MainLayout>
  );
}
