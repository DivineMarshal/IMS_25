"use client";

import { useState, useEffect, useRef } from "react";
import MainLayout from "@/app/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DialogForm } from "@/app/components/ui/dialog-form";
import { Plus, Award, Trash, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers/auth-provider";

interface FacultyAward {
  award_id: number;
  faculty_id: string;
  award_name: string;
  organization: string;
  award_description: string;
  date: string;
  category?: string;
  certificate?: string; // Added for certificate URL
}

interface AwardFormData {
  award_name: string;
  organization: string;
  award_description: string;
  date: string;
  category?: string;
}

export default function FacultyAwardsPage() {
  const { user, loading } = useAuth();
  const [awards, setAwards] = useState<FacultyAward[]>([]);
  const [awardsLoading, setAwardsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAward, setSelectedAward] = useState<FacultyAward | null>(null);
  const [formData, setFormData] = useState<AwardFormData>({
    award_name: "",
    organization: "",
    award_description: "",
    date: new Date().toISOString().split("T")[0],
    category: "",
  });
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user?.username) {
      fetchAwards();
    }
  }, [loading, user]);

  const fetchAwards = async () => {
    try {
      setAwardsLoading(true);
      if (!user?.username) {
        throw new Error("User not authenticated. Please log in again.");
      }
      const response = await fetch(`/api/faculty/awards?facultyId=${user.username}`);

      if (!response.ok) {
        throw new Error("Failed to fetch awards");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch awards");
      }
      // console.log("data::", data);
      setAwards(data.data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching awards:", err);
      setError(err instanceof Error ? err.message : "Failed to load awards");
    } finally {
      setAwardsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed for certificates.");
      setCertificateFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setCertificateFile(file);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certificateFile) {
      toast.error("Certificate (PDF) is required");
      return;
    }
    if (
      !formData.award_name ||
      !formData.organization ||
      !formData.award_description ||
      !formData.date
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!user?.username) {
      toast.error("User not authenticated. Please log in again.");
      return;
    }
    try {
      setIsSubmitting(true);
      const form = new FormData();
      form.append("award_name", formData.award_name);
      form.append("awarding_organization", formData.organization);
      form.append("award_description", formData.award_description);
      form.append("award_date", formData.date);
      form.append("category", formData.category || "");
      form.append("certificate", certificateFile);
      form.append("facultyId", user.username);
      const response = await fetch("/api/faculty/awards", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to add award");
      }
      toast.success("Award added successfully");
      setAddDialogOpen(false);
      setFormData({
        award_name: "",
        organization: "",
        award_description: "",
        date: new Date().toISOString().split("T")[0],
        category: "",
      });
      setCertificateFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchAwards();
    } catch (err) {
      console.error("Error adding award:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add award");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAward) return;

    if (
      !formData.award_name ||
      !formData.organization ||
      !formData.award_description ||
      !formData.date
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      let response;
      // If a new certificate file is chosen, use FormData and multipart/form-data
      if (certificateFile) {
        const form = new FormData();
        form.append("award_name", formData.award_name);
        form.append("awarding_organization", formData.organization);
        form.append("award_description", formData.award_description);
        form.append("award_date", formData.date);
        form.append("category", formData.category || "");
        form.append("certificate", certificateFile);
        response = await fetch(`/api/faculty/awards?awardId=${selectedAward.award_id}`, {
          method: "PUT",
          body: form,
        });
      } else {
        // Otherwise, send JSON as before
        response = await fetch(`/api/faculty/awards?awardId=${selectedAward.award_id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            award_name: formData.award_name,
            awarding_organization: formData.organization,
            award_description: formData.award_description,
            award_date: formData.date,
            category: formData.category,
          })
        });
      }
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update award");
      }
      toast.success("Award updated successfully");
      setEditDialogOpen(false);
      setSelectedAward(null);

      // Refresh awards list
      await fetchAwards();
    } catch (err) {
      console.error("Error updating award:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update award"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAward) return;

    try {
      const response = await fetch(`/api/faculty/awards?awardId=${selectedAward.award_id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete award");
      }

      toast.success("Award deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedAward(null);

      // Refresh awards list
      await fetchAwards();
    } catch (err) {
      console.error("Error deleting award:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete award"
      );
    }
  };

  const handleViewDetails = (award: FacultyAward) => {
    setSelectedAward(award);
    // console.log("within handle: ",award);
    setFormData({
      award_name: award.award_name,
      organization: award.organization,
      award_description: award.award_description,
      date: award.date,
      category: award.category || "",
    });
    setViewDialogOpen(true);
  };

  const handleEdit = () => {
    setViewDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = () => {
    setViewDialogOpen(false);
    setDeleteDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Awards & Recognitions
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your academic and professional awards and honors
            </p>
          </div>
          <Button
            className="flex items-center gap-2"
            onClick={() => {
              setFormData({
                award_name: "",
                organization: "",
                award_description: "",
                date: new Date().toISOString().split("T")[0],
                category: "",
              });
              setCertificateFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
              setAddDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add Award
          </Button>
        </div>

        {/* Main content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-sky-600" />
              Your Awards
            </CardTitle>
          </CardHeader>
          <CardContent>
            {awardsLoading ? (
              <p>Loading awards...</p>
            ) : error ? (
              <div className="bg-red-50 text-red-500 p-4 rounded">
                <p>{error}</p>
              </div>
            ) : awards.length === 0 ? (
              <p className="text-gray-500">
                No awards found. Use the "Add Award" button to create one.
              </p>
            ) : (
              <div className="space-y-4">
                {awards.map((award) => {
  /* console.log(
    award.category,
    awards.length,
    award.award_name,
    award.award_id,
    award.date,
    award.award_description,
    award.faculty_id,
    award.organization
  );*/

  return (
    <div
      key={award.award_id}
      className="p-4 border rounded-lg hover:bg-gray-50"
    >
      <div className="flex justify-between">
        <h3 className="font-medium">{award.award_name}</h3>
        {award.category && (
          <span className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
            {award.category}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-600 mt-1">
        {award.organization}
      </p>
      <p className="text-sm text-gray-600 mt-1">
        {award.award_description && award.award_description.length > 150
          ? `${award.award_description.substring(0, 150)}...`
          : award.award_description}
      </p>
      <div className="flex justify-between mt-3">
        <span className="text-xs text-gray-500">{formatDate(award.date)}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetails(award)}
        >
          View Details
        </Button>
      </div>
    </div>
  );
})}

              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Award Dialog */}
      <DialogForm
        title="Add Award"
        description="Add a new award or recognition to your profile"
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Add Award"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="award_name">
              Award Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="award_name"
              name="award_name"
              placeholder="Enter the title of your award"
              value={formData.award_name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization">
              Awarding Organization <span className="text-red-500">*</span>
            </Label>
            <Input
              id="organization"
              name="organization"
              placeholder="Enter the organization that gave the award"
              value={formData.organization}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="award_description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="award_description"
              name="award_description"
              placeholder="Enter a description of the award and your achievement"
              value={formData.award_description}
              onChange={handleInputChange}
              required
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">
                Award Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Award Category</Label>
              <Input
                id="category"
                name="category"
                placeholder="E.g., Teaching, Research, Service"
                value={formData.category || ""}
                onChange={handleInputChange}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="certificate">
              Certificate (PDF) <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-md border border-gray-300 hover:bg-gray-300 transition text-sm font-medium"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                Choose PDF
              </button>
              <span className="text-gray-700 text-sm">
                {certificateFile ? certificateFile.name : "No file chosen"}
              </span>
            </div>
            <input
              id="certificate"
              type="file"
              accept="application/pdf"
              required
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-1">Only PDF files are allowed. Max size: 30MB.</p>
          </div>
        </div>
      </DialogForm>

      {/* View Award Dialog */}
      <DialogForm
        title="Award Details"
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onSubmit={(e) => {
          e.preventDefault();
          setViewDialogOpen(false);
        }}
  
        
      >
        {selectedAward && (
          <div className="space-y-4">
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={handleEdit}
              >
                <Pencil size={14} />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDeleteClick}
              >
                <Trash size={14} />
                Delete
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Award Title</Label>
              <p className="text-sm">{selectedAward.award_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Awarding Organization</Label>
              <p className="text-sm">{selectedAward.organization}</p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <p className="text-sm">{selectedAward.award_description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Award Date</Label>
                <p className="text-sm">{formatDate(selectedAward.date)}</p>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                {selectedAward.category ? (
                  <div className="inline-block px-2 py-1 text-sm bg-blue-50 text-blue-700 rounded">
                    {selectedAward.category}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Not specified</p>
                )}
              </div>
            </div>
            {selectedAward.certificate && (
              <div className="mt-4">
                <a
                  href={selectedAward.certificate}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm font-medium hover:bg-blue-200 transition"
                >
                  View Certificate
                </a>
              </div>
            )}
          </div>
        )}
      </DialogForm>

      {/* Edit Award Dialog */}
      <DialogForm
        title="Edit Award"
        description="Update the details of your award or recognition"
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit_award_name">
              Award Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit_award_name"
              name="award_name"
              placeholder="Enter the title of your award"
              value={formData.award_name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_organization">
              Awarding Organization <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit_organization"
              name="organization"
              placeholder="Enter the organization that gave the award"
              value={formData.organization}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_award_description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="edit_award_description"
              name="award_description"
              placeholder="Enter a description of the award and your achievement"
              value={formData.award_description}
              onChange={handleInputChange}
              required
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_date">
                Award Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit_date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_category">Award Category</Label>
              <Input
                id="edit_category"
                name="category"
                placeholder="E.g., Teaching, Research, Service"
                value={formData.category || ""}
                onChange={handleInputChange}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="certificate">
              Certificate (PDF) <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-md border border-gray-300 hover:bg-gray-300 transition text-sm font-medium"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                Choose PDF
              </button>
              <span className="text-gray-700 text-sm">
                {certificateFile ? certificateFile.name : "No file chosen"}
              </span>
            </div>
            <input
              id="certificate"
              type="file"
              accept="application/pdf"
              required
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-1">Only PDF files are allowed. Max size: 30MB.</p>
          </div>
        </div>
      </DialogForm>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              award from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
