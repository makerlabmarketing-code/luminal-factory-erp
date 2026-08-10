// app/admin/metadata/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useNotification } from "@/component/NotificationContext";
import {
  Plus,
  Trash2,
  Save,
  Layers,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  type SystemMetadataCategory,
  type SystemMetadataRow,
  type SystemMetadataValue,
} from "@/lib/system-metadata-defaults";

interface SystemMetadataResponse {
  success?: boolean;
  categories?: SystemMetadataCategory[];
  category?: SystemMetadataCategory;
  message?: string;
}

export default function MetadataManagement() {
  const { showToast, showConfirm } = useNotification();
  const [categories, setCategories] = useState<SystemMetadataCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [subSearchTerm, setSubSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState("1");

  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMetadata = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/system-metadata", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as SystemMetadataResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Không thể tải danh mục hệ thống.");
      }

      const loadedCategories = payload.categories || [];
      setCategories(loadedCategories);
      setSelectedCatId((currentCategoryId) => {
        if (currentCategoryId && loadedCategories.some((item) => String(item.id) === currentCategoryId)) {
          return currentCategoryId;
        }
        return loadedCategories[0]?.id != null ? String(loadedCategories[0].id) : "";
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải danh mục hệ thống.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  const handleCategoryFilterChange = (catId: string) => {
    setSelectedCatId(catId);
    setCurrentPage(1);
    setPageInput("1");
    setSubSearchTerm("");
  };

  const activeCategory = categories.find((c) => c.id === Number(selectedCatId));
  const isFallbackCategory = Boolean(activeCategory?.isFallback);
  const activeData = activeCategory ? activeCategory.data || [] : [];

  const rowsWithGlobalIndex: Array<
    SystemMetadataRow & { __globalIndex: number }
  > = activeData.map((row: SystemMetadataRow, index: number) => ({
    ...row,
    __globalIndex: index,
  }));

  const filteredRows = rowsWithGlobalIndex.filter((row) => {
    return Object.keys(row).some((key: string) => {
      if (key === "__globalIndex") return false;
      return String(row[key])
        .toLowerCase()
        .includes(subSearchTerm.toLowerCase());
    });
  });

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const tableHeaders =
    activeData.length > 0
      ? Object.keys(activeData[0]).filter((k) => k !== "__globalIndex")
      : [];

  const getInputValue = (
    row: SystemMetadataRow,
    key: string,
  ): string | number => {
    const value = row[key];
    return typeof value === "number" ? value : String(value ?? "");
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim())
      return showToast(
        "Thiếu thông tin",
        "Vui lòng nhập tên danh mục.",
        "error",
      );

    setSaving(true);
    try {
      const response = await fetch("/api/admin/system-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as SystemMetadataResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Không thể tạo danh mục hệ thống.");
      }

      if (payload.category?.id != null) setSelectedCatId(String(payload.category.id));
      setNewCatName("");
      await loadMetadata();
      showToast("Thành công", "Đã tạo danh mục hệ thống.", "success");
    } catch (error) {
      showToast(
        "Không thể tạo danh mục",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = () => {
    if (!activeCategory || isFallbackCategory) return;
    showConfirm(
      "Ngừng dùng danh mục",
      `Sếp có chắc chắn muốn ngừng dùng danh mục [${activeCategory.name}] cùng toàn bộ thuộc tính con không?`,
      async () => {
        try {
          const response = await fetch(
            `/api/admin/system-metadata?id=${encodeURIComponent(String(activeCategory.id))}`,
            { method: "DELETE" },
          );
          const payload = (await response.json().catch(() => null)) as SystemMetadataResponse | null;
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.message || "Không thể gỡ danh mục hệ thống.");
          }

          setSelectedCatId("");
          await loadMetadata();
          showToast("Đã cập nhật", "Danh mục lớn đã được gỡ bỏ.", "info");
        } catch (error) {
          showToast(
            "Không thể gỡ danh mục",
            error instanceof Error ? error.message : "Vui lòng thử lại.",
            "error",
          );
        }
      },
    );
  };

  const handleAddRow = () => {
    if (!activeCategory || isFallbackCategory) return;
    let newRow: SystemMetadataRow = {};
    const nameLower = activeCategory.name.toLowerCase();

    if (nameLower.includes("cấp bậc & lương")) {
      newRow = { level: "Bậc mới", rate: 30000 };
    } else if (nameLower.includes("vị trí & cấp bậc")) {
      newRow = { title: "Vị trí mới", level: "A1" };
    } else {
      newRow =
        tableHeaders.length > 0
          ? tableHeaders.reduce(
              (acc, currentKey) => ({
                ...acc,
                [currentKey]: currentKey === "rate" ? 0 : "Nhập dữ liệu",
              }),
              {},
            )
          : { key: "Nhãn", value: "Giá trị" };
    }

    const updatedData = [...activeCategory.data, newRow];
    setCategories(
      categories.map((c) =>
        c.id === activeCategory.id ? { ...c, data: updatedData } : c,
      ),
    );
    setTimeout(() => {
      setCurrentPage(Math.ceil(updatedData.length / itemsPerPage) || 1);
    }, 50);
  };

  const handleUpdateRowValue = (
    globalIndex: number,
    field: string,
    value: SystemMetadataValue,
  ) => {
    if (!activeCategory || isFallbackCategory) return;
    const newData = [...activeCategory.data];
    newData[globalIndex] = {
      ...newData[globalIndex],
      [field]: field === "rate" ? Number(value) : value,
    };
    setCategories(
      categories.map((c) =>
        c.id === activeCategory.id ? { ...c, data: newData } : c,
      ),
    );
  };

  const handleRemoveRow = (globalIndex: number) => {
    if (!activeCategory || isFallbackCategory) return;

    const newData = [...activeCategory.data];
    newData.splice(globalIndex, 1);

    setCategories(
      categories.map((c) =>
        c.id === activeCategory.id ? { ...c, data: newData } : c,
      ),
    );
    const maxPage = Math.ceil(newData.length / itemsPerPage) || 1;
    if (currentPage > maxPage) setCurrentPage(maxPage);
  };

  const handleSaveCategory = async () => {
    if (!activeCategory || saving) return;
    if (isFallbackCategory) {
      showToast(
        "Cần tạo danh mục hệ thống",
        "Danh mục mặc định chỉ dùng khi hệ thống chưa có cấu hình. Hãy tạo danh mục hệ thống trước khi lưu.",
        "info",
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/system-metadata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeCategory.id, data: activeCategory.data }),
      });
      const payload = (await response.json().catch(() => null)) as SystemMetadataResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Không thể cập nhật danh mục hệ thống.");
      }

      showToast(
        "Đồng bộ thành công",
        `✨ Đã cập nhật danh mục [${activeCategory.name}] lên Cloud!`,
        "success",
      );
    } catch (error) {
      showToast(
        "Không thể lưu danh mục",
        error instanceof Error ? error.message : "Dữ liệu đã nhập vẫn được giữ lại. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      {/* HEADER TỔNG */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" />
          <div>
            <h1 className="text-base font-bold">Danh mục hệ thống</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Quản lý các danh mục nghiệp vụ dùng lại trong hệ thống.
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-xs">
          <input
            type="text"
            placeholder="Tạo danh mục..."
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none w-44"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
          />
          <button
            onClick={handleCreateCategory}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 font-bold px-3 py-1.5 rounded-lg text-white transition flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo danh mục
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-100">
          <p className="font-bold text-red-300">Không thể tải danh mục hệ thống</p>
          <p className="mt-1 text-red-100/80">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadMetadata()}
            className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-1.5 text-[11px] font-bold text-red-100 hover:bg-red-900/40"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* CONTAINER BẢNG DỮ LIỆU CHUYÊN NGHIỆP */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <select
              className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-purple-300 font-black focus:outline-none w-full md:w-64 cursor-pointer"
              value={selectedCatId}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
              disabled={loading || categories.length === 0}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  📁 {c.name} ({c.data?.length || 0})
                </option>
              ))}
            </select>
            {activeCategory && !isFallbackCategory && (
              <button
                onClick={handleDeleteCategory}
                disabled={saving}
                className="p-2 bg-slate-950 border border-red-900/30 text-red-400 hover:bg-red-950/20 rounded-xl text-[10px] font-bold transition disabled:opacity-50"
              >
                Ngừng dùng danh mục
              </button>
            )}
          </div>

          {isFallbackCategory && (
            <p className="text-[10px] font-bold text-amber-300">
              Đang hiển thị danh mục mặc định vì DB chưa có dữ liệu.
            </p>
          )}

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="relative w-full md:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm nội dung con..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
                value={subSearchTerm}
                onChange={(e) => {
                  setSubSearchTerm(e.target.value);
                  setCurrentPage(1);
                  setPageInput("1");
                }}
              />
            </div>
            <button
              onClick={handleSaveCategory}
              disabled={isFallbackCategory || saving || !activeCategory}
              title={
                isFallbackCategory
                  ? "Danh mục mặc định chỉ hiển thị khi DB chưa có dữ liệu."
                  : undefined
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1 transition shrink-0 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? "Đang lưu..." : "Lưu bảng"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 table-fixed min-w-[600px]">
            <thead className="bg-slate-950 text-slate-500 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                {tableHeaders.map((header) => (
                  <th key={header} className="p-4 font-bold text-slate-400">
                    {header}
                  </th>
                ))}
                <th className="p-4 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableHeaders.length + 1}
                    className="p-8 text-center text-slate-500 font-mono italic"
                  >
                    {loading
                      ? "Đang tải danh mục hệ thống..."
                      : "Chưa có hàng dữ liệu con nào khớp bộ lọc tra cứu."}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr
                    key={row.__globalIndex}
                    className="hover:bg-slate-950/30 transition"
                  >
                    {tableHeaders.map((key) => (
                      <td key={key} className="p-3">
                        <input
                          type={key === "rate" ? "number" : "text"}
                          className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none font-medium"
                          value={getInputValue(row, key)}
                          onChange={(e) =>
                            handleUpdateRowValue(
                              row.__globalIndex,
                              key,
                              e.target.value,
                            )
                          }
                          disabled={isFallbackCategory || saving}
                        />
                      </td>
                    ))}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRemoveRow(row.__globalIndex)}
                        disabled={isFallbackCategory || saving}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* THANH PHÂN TRANG */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-slate-400 select-none">
          <div className="w-full md:w-auto flex justify-between md:justify-start items-center gap-4">
            <button
              onClick={handleAddRow}
              disabled={isFallbackCategory || saving || !activeCategory}
              className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition font-sans disabled:opacity-30"
            >
              <Plus className="w-4 h-4" /> Thêm hàng con mới
            </button>
            <div>
              Tổng{" "}
              <span className="text-purple-400 font-bold">
                {filteredRows.length}
              </span>{" "}
              mục
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <span>Số dòng:</span>
              <select
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-bold text-slate-200 focus:outline-none cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                  setPageInput("1");
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setCurrentPage(1);
                  setPageInput("1");
                }}
                disabled={currentPage === 1}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"
              >
                <ChevronsLeft className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => {
                  const p = Math.max(1, currentPage - 1);
                  setCurrentPage(p);
                  setPageInput(String(p));
                }}
                disabled={currentPage === 1}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => {
                      setCurrentPage(page);
                      setPageInput(String(page));
                    }}
                    className={`w-7 h-7 rounded-lg font-black transition text-[11px] ${currentPage === page ? "bg-red-600 text-white shadow-md" : "bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800"}`}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                onClick={() => {
                  const p = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(p);
                  setPageInput(String(p));
                }}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"
              >
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => {
                  setCurrentPage(totalPages);
                  setPageInput(String(totalPages));
                }}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"
              >
                <ChevronsRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={totalPages}
                className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-1 text-center font-bold text-slate-100 focus:outline-none"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
              />
              <button
                onClick={() => {
                  const p = Number(pageInput);
                  if (p >= 1 && p <= totalPages) setCurrentPage(p);
                }}
                className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg font-black hover:bg-slate-800 text-slate-200 transition"
              >
                Đi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
