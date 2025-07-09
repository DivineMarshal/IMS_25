"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Download,
  Printer,
  X,
  Expand,
  ExternalLink,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface EnhancedReportPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBase64?: string;
  filename?: string;
  title: string;
  reportType?: string;
  tableData?: any[];
  columns?: string[];
}

export function EnhancedReportPreview({
  isOpen,
  onClose,
  pdfBase64,
  filename,
  title,
  reportType,
  tableData = [],
  columns = [],
}: EnhancedReportPreviewProps) {
  // Use defensive initialization to ensure we always have arrays
  const safeTableData = Array.isArray(tableData) ? tableData : [];
  const safeColumns = Array.isArray(columns) ? columns : [];

  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [activeTab, setActiveTab] = useState<string>("preview");

  // Reset filter value when filter column changes
  useEffect(() => {
    setFilterValue("");
  }, [filterColumn]);
  // Open in a new tab
  const handleOpenInNewTab = () => {
    if (!pdfBase64) return;
    try {
      const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;
      const newWindow = window.open(pdfDataUri, "_blank");

      if (!newWindow) {
        console.error("Pop-up blocked or unable to open new window");
      }
    } catch (error) {
      console.error("Error opening PDF in new tab:", error);
    }
  };
  const handleDownload = () => {
    if (!pdfBase64 || !filename) return;
    try {
      setDownloading(true);
      // Create a data URL from the base64 PDF
      const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;
      // Create an invisible link and trigger download
      const link = document.createElement("a");
      link.href = pdfDataUri;
      link.download =
        filename || `report_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up the DOM after a short delay
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 100);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    } finally {
      setDownloading(false);
    }
  };
  const handlePrint = () => {
    if (!pdfBase64) return;
    try {
      setPrinting(true);
      // Create a data URL from the base64 PDF
      const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;

      // Open the PDF in a new tab for printing
      const printWindow = window.open(pdfDataUri);

      // Trigger print dialog
      if (printWindow) {
        // Set timeout as backup in case onload doesn't fire
        const timeoutId = setTimeout(() => {
          try {
            printWindow.print();
          } catch (printError) {
            console.error("Error in delayed print:", printError);
          } finally {
            setPrinting(false);
          }
        }, 2000);

        printWindow.onload = () => {
          clearTimeout(timeoutId);
          try {
            printWindow.print();
          } catch (printError) {
            console.error("Error in print onload:", printError);
          } finally {
            setPrinting(false);
          }
        };
      } else {
        console.error("Popup blocked or could not open print window");
        setPrinting(false);
      }
    } catch (error) {
      console.error("Error printing PDF:", error);
      setPrinting(false);
    }
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setFullscreenMode(!fullscreenMode);
  }; // Filter and sort data if available
  const processedData = useMemo(() => {
    // Using our safeguarded tableData
    let filtered = [...safeTableData];

    // Apply search filter across all columns
    if (searchTerm.trim() !== "") {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some(
          (value) =>
            value && value.toString().toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply column-specific filter
    if (filterColumn && filterValue.trim() !== "") {
      const filterLower = filterValue.toLowerCase();
      filtered = filtered.filter((row) => {
        const cellValue = row[filterColumn];
        return (
          cellValue && cellValue.toString().toLowerCase().includes(filterLower)
        );
      });
    }

    // Apply sorting
    if (sortBy) {
      filtered = filtered.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        // Handle various data types
        if (aVal === null || aVal === undefined)
          return sortOrder === "asc" ? -1 : 1;
        if (bVal === null || bVal === undefined)
          return sortOrder === "asc" ? 1 : -1;

        // Try to compare as dates
        const aDate = new Date(aVal).getTime();
        const bDate = new Date(bVal).getTime();
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
        }

        // Compare as strings
        const aStr = aVal.toString().toLowerCase();
        const bStr = bVal.toString().toLowerCase();
        return sortOrder === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [safeTableData, sortBy, sortOrder, searchTerm, filterColumn, filterValue]);
  // Get unique values for a column (used for filtering)
  const getColumnValues = (column: string) => {
    const values = safeTableData
      .map((row) => row[column])
      .filter(
        (value, index, self) =>
          value !== null && value !== undefined && self.indexOf(value) === index
      );
    return values.sort();
  };

  // Dialog sizing classes based on fullscreen mode
  const dialogSizeClasses = fullscreenMode
    ? "max-w-full w-[98vw] h-[95vh] my-2"
    : "max-w-5xl w-[90vw] h-[80vh]";
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          try {
            // Only call onClose when dialog is being closed, wrapped in try-catch
            onClose();
          } catch (error) {
            console.error("Error in onClose handler:", error);
          }
        }
      }}
    >
      <DialogContent
        className={`${dialogSizeClasses} p-0 flex flex-col gap-0 overflow-hidden`}
      >
        <DialogHeader className="p-4 pb-0">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
            <div className="flex items-center ml-auto">
              <DialogClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>{" "}
          <div className="mt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="preview">PDF Preview</TabsTrigger>
                {safeTableData.length > 0 && safeColumns.length > 0 && (
                  <TabsTrigger value="interactive">
                    Interactive View
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden p-4 pt-0">
          <Tabs value={activeTab}>
            {" "}
            <TabsContent
              value="preview"
              className="h-full overflow-hidden mt-0"
            >
              {" "}
              {pdfBase64 ? (
                <iframe
                  src={`data:application/pdf;base64,${pdfBase64}`}
                  className="w-full h-full border rounded-md"
                  title="PDF Report Preview"
                  onError={(e) => {
                    console.error("Error loading PDF:", e);
                  }}
                  sandbox="allow-same-origin allow-scripts"
                />
              ) : (
                <div className="w-full h-full flex flex-col justify-center items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
                  <p className="text-gray-500">Loading report...</p>
                </div>
              )}
            </TabsContent>
            {safeTableData.length > 0 && safeColumns.length > 0 && (
              <TabsContent
                value="interactive"
                className="h-full overflow-hidden mt-0 flex flex-col"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-1">
                    <Label htmlFor="search">Search</Label>
                    <Input
                      id="search"
                      type="text"
                      placeholder="Search all columns..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>{" "}
                  <div className="space-y-1">
                    <Label htmlFor="filter-column">Filter by column</Label>
                    <Select
                      value={filterColumn || "none"}
                      onValueChange={(value) =>
                        setFilterColumn(value === "none" ? null : value)
                      }
                    >
                      <SelectTrigger id="filter-column">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {safeColumns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>{" "}
                  <div className="space-y-1">
                    <Label htmlFor="filter-value">Filter value</Label>
                    <Input
                      id="filter-value"
                      type="text"
                      placeholder="Enter filter value..."
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      disabled={!filterColumn}
                    />
                  </div>
                </div>
                <div className="overflow-auto flex-1 border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-secondary">
                      <tr>
                        {safeColumns.map((column) => (
                          <th
                            key={column}
                            className="border-b px-4 py-2 text-left font-medium cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              if (sortBy === column) {
                                setSortOrder(
                                  sortOrder === "asc" ? "desc" : "asc"
                                );
                              } else {
                                setSortBy(column);
                                setSortOrder("asc");
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              {column}
                              {sortBy === column && (
                                <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {processedData.length > 0 ? (
                        processedData.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-muted/50">
                            {safeColumns.map((column) => (
                              <td
                                key={`${rowIndex}-${column}`}
                                className="border-b px-4 py-2"
                              >
                                {row[column] !== null &&
                                row[column] !== undefined
                                  ? row[column].toString()
                                  : ""}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={safeColumns.length || 1}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No data found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>{" "}
                <div className="mt-2 text-sm text-muted-foreground">
                  {processedData.length} of {safeTableData.length} records shown
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>{" "}
        <DialogFooter className="p-4 border-t">
          <div className="flex justify-end w-full gap-2">
            <Button
              variant="outline"
              onClick={() => {
                try {
                  handlePrint();
                } catch (error) {
                  console.error("Error handling print:", error);
                  setPrinting(false);
                }
              }}
              disabled={!pdfBase64 || printing}
              className="flex items-center gap-2"
            >
              {printing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Print
            </Button>
            <Button
              onClick={() => {
                try {
                  handleDownload();
                } catch (error) {
                  console.error("Error handling download:", error);
                  setDownloading(false);
                }
              }}
              disabled={!pdfBase64 || downloading}
              className="flex items-center gap-2"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
