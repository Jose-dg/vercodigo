import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


import { Button } from "@/components/ui/button";
// import InvoiceKPI from "../components/statics/invoice-percent";

// import BulkCreateInvoiceButton from "@/components/bulk-create-invoice-button";



export const metadata = {
  title: "Dashboard Admin | Diem Ecommerce",
  description: "Panel de administración para gestionar productos, órdenes y colecciones en Diem Ecommerce.",
};

export default function Page() {
  return (
    <main>
      {/* <SidebarInset> */}

      {/* <div className="flex flex-1 flex-col gap-4 p-4"> */}
      {/* <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3"> */}
      {/* <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8"> */}
      {/* <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2"> */}
      <div className="grid auto-rows-max items-start gap-4 md:gap-8">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {/* <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4"> */}
          {/* <Card className="sm:col-span-2" x-chunk="dashboard-05-chunk-0">
            <CardHeader className="pb-3">
              <CardTitle>Your Orders</CardTitle>
              <CardDescription className="max-w-lg text-balance leading-relaxed">
                Introducing Our Dynamic Orders Dashboard for Diem Management
                and Insightful Analysis.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button>Create New Order</Button>
            </CardFooter>
          </Card>
          <SalesKPI /> */}
          {/* <InvoiceKPI /> */}
        </div>
        {/* <Tabs defaultValue="today">
          <div className="flex items-center">
            <TabsPicker />
            <div className="ml-auto flex items-center gap-2">
              <BulkCreateInvoiceButton />
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-sm"
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only">Filter</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem checked>
                      Digital
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem>
                      Shipping
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem>
                      Pre-order
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              <CopyStock />
            </div>
          </div>
          <Order />
        </Tabs> */}
      </div>
      {/* </main> */}
      {/* </div> */}
    </main>
  );
}





