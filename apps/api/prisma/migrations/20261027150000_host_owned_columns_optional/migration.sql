-- Customer data now lives in the host product. These columns are no longer written; they
-- become optional (metadata-only change, no table rewrite). Dropping them is a later step.
-- AlterTable
ALTER TABLE "authors" ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "joined_date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "books" ALTER COLUMN "isbn" DROP NOT NULL,
ALTER COLUMN "genre" DROP NOT NULL,
ALTER COLUMN "stage" DROP NOT NULL,
ALTER COLUMN "copies_sold" DROP NOT NULL,
ALTER COLUMN "royalty_earned_paise" DROP NOT NULL,
ALTER COLUMN "royalty_paid_paise" DROP NOT NULL,
ALTER COLUMN "royalty_pending_paise" DROP NOT NULL,
ALTER COLUMN "available_on" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
