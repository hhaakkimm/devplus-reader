"use client";

// Below `sm` a table turns into cards (one per row, the column header printed before each value from the
// cell's data-label, see lib/table-labels.ts). display:block drops the table semantics in Safari/VoiceOver,
// so the roles are explicit; on a native table element they are redundant and change nothing.
import * as React from "react";
import { cn } from "cn";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        role="table"
        data-slot="table"
        className={cn("w-full caption-bottom text-sm max-sm:block", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      role="rowgroup"
      data-slot="table-header"
      className={cn("[&_tr]:border-b max-sm:sr-only", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      role="rowgroup"
      data-slot="table-body"
      className={cn("max-sm:block sm:[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      role="row"
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted max-sm:mb-3 max-sm:block max-sm:rounded-lg max-sm:border max-sm:px-3 max-sm:py-2 max-sm:last:mb-0",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      role="columnheader"
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      role="cell"
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 max-sm:block max-sm:px-0 max-sm:py-1.5 max-sm:empty:hidden max-sm:break-words max-sm:whitespace-normal max-sm:before:block max-sm:before:text-xs max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
