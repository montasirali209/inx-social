-- UI Studio Phase 1.
-- Stores internal design projects and immutable high-resolution reference uploads.
CREATE TABLE "UiDesignProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "framework" TEXT NOT NULL DEFAULT 'REACT_TYPESCRIPT',
    "styling" TEXT NOT NULL DEFAULT 'TAILWIND',
    "outputType" TEXT NOT NULL DEFAULT 'SECTION',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiDesignProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UiDesignReference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "viewport" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UiDesignReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UiDesignProject_status_updatedAt_idx" ON "UiDesignProject"("status", "updatedAt");
CREATE INDEX "UiDesignProject_createdAt_idx" ON "UiDesignProject"("createdAt");
CREATE UNIQUE INDEX "UiDesignReference_storageKey_key" ON "UiDesignReference"("storageKey");
CREATE INDEX "UiDesignReference_projectId_viewport_createdAt_idx" ON "UiDesignReference"("projectId", "viewport", "createdAt");
CREATE INDEX "UiDesignReference_createdAt_idx" ON "UiDesignReference"("createdAt");

ALTER TABLE "UiDesignReference"
ADD CONSTRAINT "UiDesignReference_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "UiDesignProject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
