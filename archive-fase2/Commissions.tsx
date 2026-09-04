import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";
import { SalesAgent, CommissionPayout, Invoice } from "../types";
import {
  BadgePercent,
  Users,
  Wallet,
  Clock,
  CheckCircle2,
  Plus,
  Edit,
  Trash2,
  Printer,
  Download,
  FileSpreadsheet,
  Search,
  Filter,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Target,
  Award,
  ChevronRight,
  ArrowUpRight,
  CheckSquare,
  Square,
  FileText,
  X,
} from "lucide-react";

export const Commissions = () => {
  const {
    salesAgents,
    commissionPayouts,
    invoices,
    settings,
    addSalesAgent,
    updateSalesAgent,
    deleteSalesAgent,
    createCommissionPayout,
    deleteCommissionPayout,
  } = useStore();

  const isIndo = settings.language === "id";
  const [activeTab, setActiveTab] = useState<
    "settlement" | "agents" | "payouts"
  >("settlement");

  // Agent Modal State
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<SalesAgent | null>(null);
  const [agentForm, setAgentForm] = useState<{
    name: string;
    phone: string;
    email: string;
    commissionType: "PERCENTAGE" | "FIXED_PER_ITEM";
    commissionRate: number;
    monthlyTarget: number;
    bonusRate: number;
    notes: string;
    isActive: boolean;
  }>({
    name: "",
    phone: "",
    email: "",
    commissionType: "PERCENTAGE",
    commissionRate: 5,
    monthlyTarget: 10000000,
    bonusRate: 2,
    notes: "",
    isActive: true,
  });

  // Filter State
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ELIGIBLE");
  const [searchInvoice, setSearchInvoice] = useState<string>("");

  // Payout Batch Selection State
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutPaymentMethod, setPayoutPaymentMethod] =
    useState<string>("TRANSFER");
  const [payoutNotes, setPayoutNotes] = useState<string>("");

  // View Voucher Modal
  const [selectedVoucher, setSelectedVoucher] =
    useState<CommissionPayout | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<SalesAgent | null>(null);
  const [payoutToDelete, setPayoutToDelete] = useState<CommissionPayout | null>(
    null,
  );

  // Invoices that have sales agent attached
  const commissionInvoices = invoices.filter((inv) => !!inv.salesAgentId);

  // Filtered invoices for settlement tab
  const filteredInvoices = commissionInvoices.filter((inv) => {
    const matchesAgent =
      selectedAgentFilter === "ALL" || inv.salesAgentId === selectedAgentFilter;
    const matchesStatus =
      statusFilter === "ALL" ||
      (inv.commissionStatus || "PENDING") === statusFilter;
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchInvoice.toLowerCase()) ||
      (inv.salesAgentName &&
        inv.salesAgentName.toLowerCase().includes(searchInvoice.toLowerCase()));
    return matchesAgent && matchesStatus && matchesSearch;
  });

  // Calculation Metrics
  const totalEligibleCommission = commissionInvoices
    .filter((inv) => inv.commissionStatus === "ELIGIBLE")
    .reduce((sum, inv) => sum + (inv.commissionAmount || 0), 0);

  const totalPaidCommission = commissionPayouts.reduce(
    (sum, p) => sum + p.amount,
    0,
  );

  const totalPendingCommission = commissionInvoices
    .filter((inv) => inv.commissionStatus === "PENDING")
    .reduce((sum, inv) => sum + (inv.commissionAmount || 0), 0);

  // Agent Performance (Current Month)
  const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const agentStats = salesAgents.map((agent) => {
    const agentInvoices = invoices.filter(
      (inv) =>
        inv.salesAgentId === agent.id && inv.date.startsWith(currentMonthStr),
    );
    const monthSales = agentInvoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );
    const monthCommission = agentInvoices.reduce(
      (sum, inv) => sum + (inv.commissionAmount || 0),
      0,
    );
    const target = agent.monthlyTarget || 1;
    const targetProgress = Math.min(
      100,
      Math.round((monthSales / target) * 100),
    );
    const isTargetAchieved = monthSales >= target && target > 0;

    return {
      agent,
      monthSales,
      monthCommission,
      targetProgress,
      isTargetAchieved,
      invoiceCount: agentInvoices.length,
    };
  });

  const openAddAgentModal = () => {
    setEditingAgent(null);
    setAgentForm({
      name: "",
      phone: "",
      email: "",
      commissionType: "PERCENTAGE",
      commissionRate: 5,
      monthlyTarget: 15000000,
      bonusRate: 2,
      notes: "",
      isActive: true,
    });
    setIsAgentModalOpen(true);
  };

  const openEditAgentModal = (agent: SalesAgent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      phone: agent.phone,
      email: agent.email || "",
      commissionType: agent.commissionType,
      commissionRate: agent.commissionRate,
      monthlyTarget: agent.monthlyTarget || 0,
      bonusRate: agent.bonusRate || 0,
      notes: agent.notes || "",
      isActive: agent.isActive,
    });
    setIsAgentModalOpen(true);
  };

  const handleSaveAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentForm.name.trim()) return;

    if (editingAgent) {
      updateSalesAgent({
        ...editingAgent,
        ...agentForm,
      });
    } else {
      addSalesAgent(agentForm);
    }
    setIsAgentModalOpen(false);
  };

  const handleToggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllEligible = () => {
    const eligibleIds = filteredInvoices
      .filter((inv) => inv.commissionStatus === "ELIGIBLE")
      .map((inv) => inv.id);

    if (
      selectedInvoiceIds.length === eligibleIds.length &&
      eligibleIds.length > 0
    ) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(eligibleIds);
    }
  };

  const handleOpenPayoutModal = () => {
    if (selectedInvoiceIds.length === 0) return;
    // Check if all selected invoices belong to the same sales agent
    const selectedInvs = invoices.filter((inv) =>
      selectedInvoiceIds.includes(inv.id),
    );
    const firstAgentId = selectedInvs[0]?.salesAgentId;
    const isSingleAgent = selectedInvs.every(
      (inv) => inv.salesAgentId === firstAgentId,
    );

    if (!isSingleAgent) {
      alert(
        isIndo
          ? "Pencairan komisi sekaligus harus berasal dari 1 Sales Agent yang sama. Harap filter per sales agent terlebih dahulu."
          : "Batch commission disbursement must be for the same Sales Agent. Please filter by a single agent first.",
      );
      return;
    }

    setPayoutPaymentMethod("TRANSFER");
    setPayoutNotes("");
    setIsPayoutModalOpen(true);
  };

  const handleConfirmPayout = () => {
    const selectedInvs = invoices.filter((inv) =>
      selectedInvoiceIds.includes(inv.id),
    );
    if (selectedInvs.length === 0) return;
    const agentId = selectedInvs[0].salesAgentId;
    if (!agentId) return;

    const payout = createCommissionPayout({
      salesAgentId: agentId,
      invoiceIds: selectedInvoiceIds,
      paymentMethod: payoutPaymentMethod,
      notes: payoutNotes,
    });

    setIsPayoutModalOpen(false);
    setSelectedInvoiceIds([]);
    if (payout) {
      setSelectedVoucher(payout);
    }
  };

  const handlePrintVoucher = () => {
    window.print();
  };

  const selectedInvoicesForPayout = invoices.filter((inv) =>
    selectedInvoiceIds.includes(inv.id),
  );
  const selectedTotalCommission = selectedInvoicesForPayout.reduce(
    (sum, inv) => sum + (inv.commissionAmount || 0),
    0,
  );
  const targetAgent = salesAgents.find(
    (a) => a.id === selectedInvoicesForPayout[0]?.salesAgentId,
  );

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <BadgePercent className="w-6 h-6 text-blue-600" />
            {isIndo
              ? "Manajemen Tim Sales & Komisi"
              : "Sales Team & Commission"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isIndo
              ? "Pantau pencapaian omzet, hitung komisi otomatis faktur lunas, dan kelola pencairan bonus sales."
              : "Track sales turnover, calculate commissions on paid invoices, and disburse agent payouts."}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={openAddAgentModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {isIndo ? "Tambah Sales Baru" : "Add Sales Agent"}
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">
              {isIndo ? "Komisi Layak Cair" : "Eligible for Payout"}
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 block">
              {formatCurrency(totalEligibleCommission)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {
                commissionInvoices.filter(
                  (i) => i.commissionStatus === "ELIGIBLE",
                ).length
              }{" "}
              {isIndo ? "Faktur Lunas" : "Paid Invoices"}
            </span>
          </div>
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {isIndo ? "Sudah Dicairkan" : "Total Disbursed"}
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 block">
              {formatCurrency(totalPaidCommission)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {commissionPayouts.length}{" "}
              {isIndo ? "Voucher Pencairan" : "Payout Vouchers"}
            </span>
          </div>
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">
              {isIndo ? "Komisi Tertunda (Piutang)" : "Pending (Unpaid)"}
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 block">
              {formatCurrency(totalPendingCommission)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {
                commissionInvoices.filter(
                  (i) => i.commissionStatus === "PENDING",
                ).length
              }{" "}
              {isIndo ? "Faktur Belum Lunas" : "Unpaid Invoices"}
            </span>
          </div>
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider block">
              {isIndo ? "Anggota Tim Sales" : "Sales Agents"}
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 block">
              {salesAgents.filter((a) => a.isActive).length}{" "}
              <span className="text-xs font-normal text-slate-500">
                / {salesAgents.length}
              </span>
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {isIndo ? "Aktif bertugas" : "Active agents"}
            </span>
          </div>
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("settlement")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "settlement"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          {isIndo ? "Pencairan Komisi Faktur" : "Commission Settlement"}
        </button>

        <button
          onClick={() => setActiveTab("agents")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "agents"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          {isIndo ? "Daftar Tim Sales & Target" : "Sales Team & Targets"}
        </button>

        <button
          onClick={() => setActiveTab("payouts")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "payouts"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="w-4 h-4" />
          {isIndo ? "Riwayat Pencairan" : "Payouts History"}
        </button>
      </div>

      {/* Tab 1: Commission Settlement (Faktur & Pencairan) */}
      {activeTab === "settlement" && (
        <div className="flex flex-col gap-4">
          {/* Target Progress Bar Highlights */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                {isIndo
                  ? "Pencapaian Target Omzet Sales Bulan Ini"
                  : "Monthly Sales Target Progress"}
              </h3>
              <span className="text-xs text-slate-500">
                {new Date().toLocaleDateString(isIndo ? "id-ID" : "en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agentStats.map(
                ({
                  agent,
                  monthSales,
                  targetProgress,
                  isTargetAchieved,
                  invoiceCount,
                }) => (
                  <div
                    key={agent.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div>
                        <span className="font-bold text-sm text-slate-900">
                          {agent.name}
                        </span>
                        <span className="text-xs text-slate-500 block">
                          {invoiceCount} {isIndo ? "transaksi" : "deals"} •{" "}
                          {agent.commissionType === "PERCENTAGE"
                            ? `${agent.commissionRate}%`
                            : `${formatCurrency(agent.commissionRate)}/item`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900">
                          {formatCurrency(monthSales)}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Target: {formatCurrency(agent.monthlyTarget || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isTargetAchieved ? "bg-blue-600" : "bg-blue-600"
                        }`}
                        style={{ width: `${Math.min(100, targetProgress)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center mt-1.5 text-[11px]">
                      <span className="text-slate-600 font-medium">
                        {targetProgress}% tercapai
                      </span>
                      {isTargetAchieved && (
                        <span className="text-blue-700 font-bold flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          {isIndo
                            ? `Bonus +${agent.bonusRate}% Aktif`
                            : `Bonus +${agent.bonusRate}% Unlocked`}
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Filters & Actions */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={
                    isIndo
                      ? "Cari no faktur / sales..."
                      : "Search invoice or sales..."
                  }
                  value={searchInvoice}
                  onChange={(e) => setSearchInvoice(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              {/* Agent Filter */}
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
              >
                <option value="ALL">
                  {isIndo ? "Semua Sales Agent" : "All Sales Agents"}
                </option>
                {salesAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white outline-none focus:border-blue-500 font-medium"
              >
                <option value="ALL">
                  {isIndo ? "Semua Status Komisi" : "All Commission Status"}
                </option>
                <option value="ELIGIBLE">
                  {isIndo
                    ? "Layak Cair (Faktur Lunas)"
                    : "Eligible (Paid Invoices)"}
                </option>
                <option value="PENDING">
                  {isIndo
                    ? "Tertunda (Faktur Belum Lunas)"
                    : "Pending (Unpaid)"}
                </option>
                <option value="PAID">
                  {isIndo ? "Sudah Dicairkan" : "Disbursed"}
                </option>
              </select>
            </div>

            {/* Batch Action Button */}
            {selectedInvoiceIds.length > 0 && (
              <button
                onClick={handleOpenPayoutModal}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                <Wallet className="w-4 h-4" />
                {isIndo
                  ? `Cairkan ${selectedInvoiceIds.length} Komisi (${formatCurrency(selectedTotalCommission)})`
                  : `Disburse ${selectedInvoiceIds.length} Commissions`}
              </button>
            )}
          </div>

          {/* Invoices Commission Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="p-3.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleSelectAllEligible}
                        className="text-slate-500 hover:text-slate-800"
                        title={
                          isIndo
                            ? "Pilih Semua yang Layak Cair"
                            : "Select all eligible"
                        }
                      >
                        {selectedInvoiceIds.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">
                      {isIndo ? "No. Faktur" : "Invoice No"}
                    </th>
                    <th className="p-3.5">{isIndo ? "Tanggal" : "Date"}</th>
                    <th className="p-3.5">
                      {isIndo ? "Sales Agent" : "Sales Agent"}
                    </th>
                    <th className="p-3.5 text-right">
                      {isIndo ? "Total Penjualan" : "Total Amount"}
                    </th>
                    <th className="p-3.5 text-right">
                      {isIndo ? "Skema / Rate" : "Rate"}
                    </th>
                    <th className="p-3.5 text-right">
                      {isIndo ? "Nominal Komisi" : "Commission"}
                    </th>
                    <th className="p-3.5 text-center">
                      {isIndo ? "Status Pembayaran" : "Invoice Status"}
                    </th>
                    <th className="p-3.5 text-center">
                      {isIndo ? "Status Komisi" : "Commission Status"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="p-8 text-center text-slate-400"
                      >
                        <BadgePercent className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium">
                          {isIndo
                            ? "Tidak ada data komisi penjualan ditemukan."
                            : "No commission records found."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isEligible = inv.commissionStatus === "ELIGIBLE";
                      const isSelected = selectedInvoiceIds.includes(inv.id);
                      const agent = salesAgents.find(
                        (a) => a.id === inv.salesAgentId,
                      );

                      return (
                        <tr
                          key={inv.id}
                          className={`hover:bg-slate-50 transition-colors ${isSelected ? "bg-blue-50/60" : ""}`}
                        >
                          <td className="p-3.5 text-center">
                            {isEligible ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  handleToggleSelectInvoice(inv.id)
                                }
                                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">
                            {inv.invoiceNumber}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {new Date(inv.date).toLocaleDateString(
                              isIndo ? "id-ID" : "en-US",
                            )}
                          </td>
                          <td className="p-3.5 font-medium text-slate-800">
                            {inv.salesAgentName || agent?.name || "Sales Agent"}
                          </td>
                          <td className="p-3.5 text-right font-semibold text-slate-900">
                            {formatCurrency(inv.totalAmount)}
                          </td>
                          <td className="p-3.5 text-right text-slate-600">
                            {inv.commissionType === "FIXED_PER_ITEM"
                              ? `${formatCurrency(inv.commissionRate || 0)}/item`
                              : `${inv.commissionRate || agent?.commissionRate || 0}%`}
                          </td>
                          <td className="p-3.5 text-right font-bold text-blue-700">
                            {formatCurrency(inv.commissionAmount || 0)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                                inv.status === "PAID"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {inv.status === "PAID"
                                ? isIndo
                                  ? "Lunas"
                                  : "Paid"
                                : isIndo
                                  ? "Belum Lunas"
                                  : "Unpaid"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {inv.commissionStatus === "ELIGIBLE" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                                <CheckCircle2 className="w-3 h-3" />
                                {isIndo ? "Layak Cair" : "Eligible"}
                              </span>
                            )}
                            {inv.commissionStatus === "PENDING" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                                <Clock className="w-3 h-3" />
                                {isIndo
                                  ? "Menunggu Pelunasan"
                                  : "Pending Payment"}
                              </span>
                            )}
                            {inv.commissionStatus === "PAID" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
                                <CheckCircle2 className="w-3 h-3" />
                                {isIndo ? "Sudah Cair" : "Disbursed"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sales Team & Targets */}
      {activeTab === "agents" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {salesAgents.map((agent) => {
            const stats = agentStats.find((s) => s.agent.id === agent.id);
            const totalEarnedAllTime = invoices
              .filter(
                (inv) =>
                  inv.salesAgentId === agent.id &&
                  inv.commissionStatus === "PAID",
              )
              .reduce((sum, inv) => sum + (inv.commissionAmount || 0), 0);

            return (
              <div
                key={agent.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-700 font-bold rounded-lg flex items-center justify-center text-base">
                        {agent.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">
                          {agent.name}
                        </h4>
                        <span className="text-xs text-slate-500">
                          {agent.phone}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        agent.isActive
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {agent.isActive
                        ? isIndo
                          ? "Aktif"
                          : "Active"
                        : isIndo
                          ? "Non-Aktif"
                          : "Inactive"}
                    </span>
                  </div>

                  {agent.email && (
                    <p className="text-xs text-slate-600 mb-2">
                      ✉️ {agent.email}
                    </p>
                  )}
                  {agent.notes && (
                    <p className="text-xs text-slate-500 italic mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      "{agent.notes}"
                    </p>
                  )}

                  <div className="space-y-2 py-3 border-t border-slate-100 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>
                        {isIndo ? "Skema Komisi:" : "Commission Scheme:"}
                      </span>
                      <span className="font-bold text-slate-900">
                        {agent.commissionType === "PERCENTAGE"
                          ? `${agent.commissionRate}% dari Total Faktur`
                          : `${formatCurrency(agent.commissionRate)} per Item Terjual`}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>
                        {isIndo
                          ? "Target Omzet Bulanan:"
                          : "Monthly Sales Target:"}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(agent.monthlyTarget || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>
                        {isIndo ? "Bonus Capai Target:" : "Target Bonus:"}
                      </span>
                      <span className="font-bold text-blue-700">
                        +{agent.bonusRate || 0}%
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                      <span>
                        {isIndo
                          ? "Total Komisi Cair (All Time):"
                          : "Total Earned (All Time):"}
                      </span>
                      <span className="font-bold text-blue-700">
                        {formatCurrency(totalEarnedAllTime)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => openEditAgentModal(agent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {isIndo ? "Edit" : "Edit"}
                  </button>
                  <button
                    onClick={() => setAgentToDelete(agent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isIndo ? "Hapus" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Payouts History (Riwayat Voucher Pencairan) */}
      {activeTab === "payouts" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="p-3.5">
                    {isIndo ? "No. Voucher" : "Voucher No"}
                  </th>
                  <th className="p-3.5">{isIndo ? "Tanggal Cair" : "Date"}</th>
                  <th className="p-3.5">
                    {isIndo ? "Sales Agent" : "Sales Agent"}
                  </th>
                  <th className="p-3.5">
                    {isIndo ? "Metode Pembayaran" : "Method"}
                  </th>
                  <th className="p-3.5 text-right">
                    {isIndo ? "Jumlah Faktur" : "Invoices Count"}
                  </th>
                  <th className="p-3.5 text-right">
                    {isIndo ? "Nominal Dicairkan" : "Amount Paid"}
                  </th>
                  <th className="p-3.5 text-center">
                    {isIndo ? "Aksi" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {commissionPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-medium">
                        {isIndo
                          ? "Belum ada riwayat pencairan komisi."
                          : "No payout records found."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  commissionPayouts.map((payout) => (
                    <tr
                      key={payout.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-3.5 font-bold text-slate-900">
                        {payout.payoutNumber}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {new Date(payout.date).toLocaleDateString(
                          isIndo ? "id-ID" : "en-US",
                        )}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800">
                        {payout.salesAgentName}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {payout.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-700">
                        {payout.invoiceIds.length}{" "}
                        {isIndo ? "Faktur" : "Invoices"}
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-blue-700">
                        {formatCurrency(payout.amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedVoucher(payout)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title={
                              isIndo ? "Cetak Slip Voucher" : "Print Voucher"
                            }
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPayoutToDelete(payout)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title={
                              isIndo ? "Batalkan Pencairan" : "Void Payout"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Add/Edit Sales Agent */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                {editingAgent
                  ? isIndo
                    ? "Edit Profil Sales Agent"
                    : "Edit Sales Agent"
                  : isIndo
                    ? "Tambah Sales Agent Baru"
                    : "Add New Sales Agent"}
              </h3>
              <button
                onClick={() => setIsAgentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveAgent}
              className="p-4 space-y-3.5 text-xs sm:text-sm"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isIndo ? "Nama Lengkap Sales" : "Full Name"}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Zakie (Field Sales)"
                  value={agentForm.name}
                  onChange={(e) =>
                    setAgentForm({ ...agentForm, name: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isIndo ? "Nomor WhatsApp / HP" : "Phone / WhatsApp"}{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="081234567890"
                    value={agentForm.phone}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, phone: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isIndo ? "Email (Opsional)" : "Email (Optional)"}
                  </label>
                  <input
                    type="email"
                    placeholder="sales@company.com"
                    value={agentForm.email}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, email: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Commission Structure */}
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 space-y-3">
                <span className="font-bold text-blue-900 block text-xs">
                  {isIndo
                    ? "Struktur Perhitungan Komisi"
                    : "Commission Calculation Structure"}
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {isIndo ? "Tipe Komisi" : "Commission Type"}
                    </label>
                    <select
                      value={agentForm.commissionType}
                      onChange={(e) =>
                        setAgentForm({
                          ...agentForm,
                          commissionType: e.target.value as any,
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
                    >
                      <option value="PERCENTAGE">
                        {isIndo ? "Persentase (%)" : "Percentage (%)"}
                      </option>
                      <option value="FIXED_PER_ITEM">
                        {isIndo
                          ? "Nominal per Item (Rp)"
                          : "Fixed per Item (Rp)"}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {agentForm.commissionType === "PERCENTAGE"
                        ? isIndo
                          ? "Tarif Komisi (%)"
                          : "Rate (%)"
                        : isIndo
                          ? "Tarif per Item (Rp)"
                          : "Rate (Rp)"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0"
                      value={agentForm.commissionRate}
                      onChange={(e) =>
                        setAgentForm({
                          ...agentForm,
                          commissionRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-100/80">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {isIndo
                        ? "Target Omzet Bulanan (Rp)"
                        : "Monthly Target (Rp)"}
                    </label>
                    <input
                      type="number"
                      step="100000"
                      min="0"
                      value={agentForm.monthlyTarget}
                      onChange={(e) =>
                        setAgentForm({
                          ...agentForm,
                          monthlyTarget: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {isIndo ? "Bonus Capai Target (%)" : "Bonus Rate (%)"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={agentForm.bonusRate}
                      onChange={(e) =>
                        setAgentForm({
                          ...agentForm,
                          bonusRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-blue-500 font-bold text-blue-700"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isIndo ? "Wilayah / Catatan" : "Territory / Notes"}
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Area Barabai & Hulu Sungai"
                  value={agentForm.notes}
                  onChange={(e) =>
                    setAgentForm({ ...agentForm, notes: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="agentActive"
                  checked={agentForm.isActive}
                  onChange={(e) =>
                    setAgentForm({ ...agentForm, isActive: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label
                  htmlFor="agentActive"
                  className="text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  {isIndo
                    ? "Sales Agent Aktif & Berhak Mendapatkan Komisi"
                    : "Active Sales Agent"}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAgentModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                >
                  {isIndo ? "Batal" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  {isIndo ? "Simpan Sales" : "Save Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Process Batch Payout */}
      {isPayoutModalOpen && targetAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                {isIndo
                  ? "Konfirmasi Pencairan Komisi Sales"
                  : "Confirm Commission Payout"}
              </h3>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    {isIndo ? "Penerima Komisi:" : "Recipient:"}
                  </span>
                  <span className="font-bold text-slate-900">
                    {targetAgent.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    {isIndo ? "Jumlah Faktur Diproses:" : "Invoices Settled:"}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedInvoiceIds.length} {isIndo ? "Faktur" : "Invoices"}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-900">
                    {isIndo
                      ? "Total Komisi Dicairkan:"
                      : "Total Payout Amount:"}
                  </span>
                  <span className="text-base font-extrabold text-blue-700">
                    {formatCurrency(selectedTotalCommission)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isIndo ? "Metode Pembayaran Kas" : "Payment Method"}
                </label>
                <select
                  value={payoutPaymentMethod}
                  onChange={(e) => setPayoutPaymentMethod(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white outline-none focus:border-blue-500"
                >
                  <option value="TRANSFER">
                    {isIndo ? "Transfer Bank" : "Bank Transfer"}
                  </option>
                  <option value="CASH">
                    {isIndo ? "Kas Tunai (Cash Out)" : "Cash Out"}
                  </option>
                  <option value="E-WALLET">
                    {isIndo ? "E-Wallet (QRIS/Dana/Gopay)" : "E-Wallet"}
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isIndo
                    ? "Catatan Pencairan (Opsional)"
                    : "Payout Notes (Optional)"}
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pencairan komisi sales periode minggu ke-4"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {isIndo
                    ? "Sistem akan otomatis mencatat Pengeluaran Kas (CASH_OUT) pada Modul Keuangan sebesar nominal komisi di atas."
                    : "A CASH_OUT transaction will be automatically recorded in the Finance module."}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                >
                  {isIndo ? "Batal" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayout}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  {isIndo
                    ? "Konfirmasi & Cetak Bukti"
                    : "Disburse & Print Slip"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Printable Voucher Slip Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 print:hidden">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-600" />
                {isIndo
                  ? "Slip Bukti Pencairan Komisi"
                  : "Commission Payout Voucher"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintVoucher}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isIndo ? "Cetak Slip" : "Print Slip"}
                </button>
                <button
                  onClick={() => setSelectedVoucher(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Voucher Body (Printable) */}
            <div className="p-6 overflow-y-auto flex-1 text-slate-800 space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {settings.brandName || "THE NODE SUPPLY"}
                  </h2>
                  <p className="text-xs text-slate-500 max-w-xs">
                    {settings.companyAddress}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
                    BUKTI PENCAIRAN KOMISI
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 block">
                    {selectedVoucher.payoutNumber}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {new Date(selectedVoucher.date).toLocaleDateString(
                      isIndo ? "id-ID" : "en-US",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  </span>
                </div>
              </div>

              {/* Recipient info */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">
                    Diberikan Kepada:
                  </span>
                  <span className="font-bold text-slate-900 text-sm block">
                    {selectedVoucher.salesAgentName}
                  </span>
                  <span className="text-slate-600 block mt-0.5">
                    Metode: {selectedVoucher.paymentMethod}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">
                    Total Komisi Diterima:
                  </span>
                  <span className="font-extrabold text-blue-700 text-base block">
                    {formatCurrency(selectedVoucher.amount)}
                  </span>
                </div>
              </div>

              {/* Invoices List */}
              <div className="space-y-1.5">
                <span className="font-bold text-xs text-slate-700 block">
                  Rincian Faktur Penjualan yang Dicairkan:
                </span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-2">No. Faktur</th>
                        <th className="p-2 text-right">Nilai Faktur</th>
                        <th className="p-2 text-right">Nominal Komisi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedVoucher.invoiceIds.map((invId) => {
                        const inv = invoices.find((i) => i.id === invId);
                        return (
                          <tr key={invId}>
                            <td className="p-2 font-medium text-slate-800">
                              {inv?.invoiceNumber || invId}
                            </td>
                            <td className="p-2 text-right text-slate-600">
                              {formatCurrency(inv?.totalAmount || 0)}
                            </td>
                            <td className="p-2 text-right font-bold text-blue-700">
                              {formatCurrency(inv?.commissionAmount || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedVoucher.notes && (
                <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  Catatan: {selectedVoucher.notes}
                </p>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div>
                  <span className="text-slate-500 block">
                    Penerima (Sales Agent)
                  </span>
                  <div className="h-16" />
                  <span className="font-bold text-slate-900 border-t border-slate-400 pt-1 block mx-4">
                    {selectedVoucher.salesAgentName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Disetujui Oleh (Keuangan/Manager)
                  </span>
                  <div className="h-16" />
                  <span className="font-bold text-slate-900 border-t border-slate-400 pt-1 block mx-4">
                    {settings.salesPerson || "Finance Manager"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Agent Confirmation Modal */}
      {agentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              {isIndo ? "Hapus Sales Agent?" : "Delete Sales Agent?"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              {isIndo
                ? `Apakah Anda yakin ingin menghapus data sales agent "${agentToDelete.name}"? Riwayat faktur yang sudah dicatat tidak akan terhapus.`
                : `Are you sure you want to delete "${agentToDelete.name}"? Existing invoices will be preserved.`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAgentToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                {isIndo ? "Batal" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  deleteSalesAgent(agentToDelete.id);
                  setAgentToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                {isIndo ? "Ya, Hapus" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payout Confirmation Modal */}
      {payoutToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              {isIndo
                ? "Batalkan Pencairan Komisi?"
                : "Void Commission Payout?"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              {isIndo
                ? `Apakah Anda yakin ingin membatalkan voucher "${payoutToDelete.payoutNumber}"? Tindakan ini akan mengembalikan status faktur terkait ke "Layak Cair" dan membatalkan pengeluaran kas keuangan.`
                : `Are you sure you want to void voucher "${payoutToDelete.payoutNumber}"? Associated invoices will return to eligible status and finance records will be updated.`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPayoutToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                {isIndo ? "Batal" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  deleteCommissionPayout(payoutToDelete.id);
                  setPayoutToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                {isIndo ? "Ya, Batalkan" : "Void Payout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
