This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.


## 2. Luồng xử lý tổng thể
```mermaid
%%{init: {"theme": "neutral", "sequence": {"mirrorActors": false, "rightAngles": true}} }%%
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant UI as 🖥️ UI (Next.js)
    participant API as ⚙️ API Route (/api/mock/[...path])
    participant DB as 🧱 SQLite (Prisma)
    participant M as 🧮 MockEngine
    participant P as 🧠 ProcessorRunner

    U->>UI: Click "Run Mock"
    UI->>API: POST /api/mock/{project}/{endpoint}
    Note right of API: Nhận request với body, params, headers

    API->>DB: 🔍 Tìm project theo tên
    alt ❌ Không có project
        API-->>UI: 404 Project not found
    else ✅ Có project
        API->>API: loadOpenApi(proj.file)
        alt ❌ File lỗi hoặc không có paths
            API-->>UI: 500 Invalid OpenAPI file
        else ✅ Parse thành công
            API->>API: tìm endpoint theo path + method
            alt ❌ Không khớp
                API-->>UI: 404 Endpoint not found
            else ✅ Tìm thấy operation
                API->>API: validateRequest(req, operation)
                alt ⚠️ Thiếu field bắt buộc
                    API->>M: generateFakeDataFromSchema(schema400)
                    M-->>API: Dữ liệu lỗi mẫu (Validation error)
                    API-->>UI: 400 Validation error + missingFields
                else ✅ Request hợp lệ
                    API->>DB: Lấy processors (pre, post, expectation)
                    DB-->>API: Danh sách processors
                    API->>P: checkExpectations(req, res)
                    alt ✅ Match expectation
                        P-->>API: return response
                        API-->>UI: 200 Response from expectation
                    else ❌ Không match
                        loop Pre-processors
                            API->>P: runProcessor(code, req, {}, logs)
                            alt ✅ Có result
                                P-->>API: result
                                API-->>UI: 200 Pre-processor response
                                break
                            else ❌ Không có result
                                continue
                            end
                        end
                        API->>M: generateMock(schema200)
                        M-->>API: JSON giả lập
                        API->>DB: SELECT mapping FROM Mapping WHERE endpoint=?
                        alt ✅ Có mapping
                            API->>M: runSQLMapping(sql, mockData)
                            M-->>API: Update mockData
                        else ❌ Không có mapping
                            Note right of API: Bỏ qua mapping DB
                        end
                        loop Post-processors
                            API->>P: runProcessor(code, req, mockData)
                            alt ⚠️ Lỗi
                                P-->>API: throw Error
                                API->>API: Log post error
                            else ✅ Thành công
                                continue
                            end
                        end
                        API-->>UI: 200 Final Mock Response
                    end
                end
            end
        end
    end
