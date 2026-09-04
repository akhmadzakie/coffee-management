CREATE TABLE "clients" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"tier" varchar(50),
	"coffee_shop" text NOT NULL,
	"pic_name" text NOT NULL,
	"role" text NOT NULL,
	"contact" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"date" text NOT NULL,
	"amount" real NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"reference_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"invoice_number" text NOT NULL,
	"order_name" text NOT NULL,
	"product_id" varchar(255) NOT NULL,
	"quantity" real NOT NULL,
	"date" text NOT NULL,
	"total_price" real NOT NULL,
	"price_per_item" real NOT NULL,
	"capital" real NOT NULL,
	"shipping_cost" real NOT NULL,
	"payment_status" varchar(50) NOT NULL,
	"batch_number" text,
	"expiry_date" text
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"date" text NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal" real NOT NULL,
	"discount_total" real NOT NULL,
	"total_amount" real NOT NULL,
	"status" varchar(50) NOT NULL,
	"payments" jsonb
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"category" text NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"item_name" text NOT NULL,
	"cost_price" real NOT NULL,
	"normal_price" real NOT NULL,
	"operational_cost" real NOT NULL,
	"selling_price" real NOT NULL,
	"price_gold" real,
	"price_vip" real,
	"profit" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" varchar(255) NOT NULL,
	"date" text NOT NULL,
	"items" jsonb NOT NULL,
	"total_amount" real NOT NULL,
	"status" varchar(50) NOT NULL,
	"delivery_status" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"logo_data_url" text,
	"brand_name" text NOT NULL,
	"company_address" text NOT NULL,
	"bank_details" text NOT NULL,
	"sales_person" text NOT NULL,
	"footer_message" text NOT NULL,
	"language" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pic_name" text NOT NULL,
	"contact" text NOT NULL,
	"address" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"pin" text NOT NULL,
	"name" text NOT NULL,
	"role" varchar(50) NOT NULL
);
