"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PiWalletLight, PiMoneyLight } from "react-icons/pi";

import FeatureTitle from "./feature-title";

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount / 100);
}

export function CommissionsDashboard() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const commissions = useQuery(
    api.commissions.getCommissions,
    isAuthenticated && user?.id ? { userId: user.id } : "skip",
  );
  const stats = useQuery(
    api.commissions.getCommissionStats,
    isAuthenticated && user?.id ? { userId: user.id } : "skip",
  );

  if (!user?.id) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <FeatureTitle
          Icon={PiWalletLight}
          title="Referral Commissions"
          description="Track your referral earnings"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PiMoneyLight className="h-4 w-4" />
                Total Earned
              </div>
              <div className="mt-1 text-2xl font-bold">{formatCurrency(stats.totalEarned)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Pending</div>
              <div className="mt-1 text-2xl font-bold">{formatCurrency(stats.pending)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Total Commissions</div>
              <div className="mt-1 text-2xl font-bold">{stats.count}</div>
            </div>
          </div>
        )}

        {commissions === undefined ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : commissions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            You {"haven't"} earned any commissions yet
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Paid Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((commission) => (
                <TableRow key={commission._id}>
                  <TableCell className="font-medium">{formatCurrency(commission.amount)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        commission.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : commission.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {commission.status}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(commission.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {commission.paidAt ? new Date(commission.paidAt).toLocaleDateString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
