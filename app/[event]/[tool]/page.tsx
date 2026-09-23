import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { toISODate } from '@/lib/format';
import { TOOLS, findTool } from '@/lib/tools';
import { ogMeta } from '@/lib/site';
import { ParentalLeaveTool } from '@/components/tools/ParentalLeaveTool';
import { CoupleLeaveTool } from '@/components/tools/CoupleLeaveTool';
import { BirthGrantsTool } from '@/components/tools/BirthGrantsTool';
import { LeaveTimelineTool } from '@/components/tools/LeaveTimelineTool';
import { SocialDuesTool } from '@/components/tools/SocialDuesTool';
import { MarriageTaxCreditTool } from '@/components/tools/MarriageTaxCreditTool';
import { JeonseLoanTool } from '@/components/tools/JeonseLoanTool';
import { JobChangeTool } from '@/components/tools/JobChangeTool';
import { SeverancePayTool } from '@/components/tools/SeverancePayTool';
import { UnemploymentBenefitTool } from '@/components/tools/UnemploymentBenefitTool';
import { RestBenefitsTool } from '@/components/tools/RestBenefitsTool';
import { GiftTaxTool } from '@/components/tools/GiftTaxTool';

export function generateStaticParams() {
  return TOOLS.map((t) => ({ event: t.event, tool: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string; tool: string }>;
}): Promise<Metadata> {
  const { event, tool } = await params;
  const found = findTool(event, tool);
  if (!found) return {};
  const path = `/${found.event}/${found.slug}`;
  const description = `${found.lead} 계산 과정과 근거 조문을 함께 보여드립니다.`;
  return {
    title: `${found.question} — ${found.title}`,
    description,
    alternates: { canonical: path },
    ...ogMeta({ path, title: found.question, description, card: found.event }),
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ event: string; tool: string }>;
}) {
  const { event, tool } = await params;
  const found = findTool(event, tool);
  if (!found) notFound();

  // 정적 프리렌더 HTML과 첫 클라이언트 렌더가 같아야 하므로 날짜 기본값을 서버에서 넘긴다.
  // 하이드레이션이 끝나면 도구가 알아서 진짜 오늘 날짜로 바꾼다.
  const fallbackToday = toISODate(new Date());

  switch (found.slug) {
    case 'parental-leave-pay':
      return <ParentalLeaveTool tool={found} fallbackToday={fallbackToday} />;
    case 'couple-leave':
      return <CoupleLeaveTool tool={found} fallbackToday={fallbackToday} />;
    case 'birth-grants':
      return <BirthGrantsTool tool={found} fallbackToday={fallbackToday} />;
    case 'rest-benefits':
      return <RestBenefitsTool tool={found} fallbackToday={fallbackToday} />;
    case 'gift-tax':
      return <GiftTaxTool tool={found} fallbackToday={fallbackToday} />;
    case 'leave-timeline':
      return <LeaveTimelineTool tool={found} fallbackToday={fallbackToday} />;
    case 'social-dues':
      return <SocialDuesTool tool={found} />;
    case 'jeonse-loan':
      return <JeonseLoanTool tool={found} />;
    case 'salary-compare':
      return <JobChangeTool tool={found} />;
    case 'severance-pay':
      return <SeverancePayTool tool={found} fallbackToday={fallbackToday} />;
    case 'unemployment-benefit':
      return <UnemploymentBenefitTool tool={found} />;
    case 'marriage-tax-credit':
      return <MarriageTaxCreditTool tool={found} fallbackToday={fallbackToday} />;
    default:
      notFound();
  }
}
