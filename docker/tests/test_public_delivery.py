"""Public delivery contracts shared by the portfolio, CMS and reverse proxy."""

import hashlib
import unittest
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
RESUMES = [
    ROOT / 'apps' / app / 'public/resume/zhang-jinpeng-ai-product-builder.pdf'
    for app in ('portfolio', 'web')
]


class PublicDeliveryTests(unittest.TestCase):
    def test_both_resume_downloads_have_the_confirmed_facts(self):
        for path in RESUMES:
            with self.subTest(app=path.parts[-4]):
                text = ''.join(page.extract_text() or '' for page in PdfReader(path).pages)
                compact = ''.join(text.split())
                for fact in ('2026.06-2026.08', '专业排名前2%', '国家级奖项3项、省市级奖项8项'):
                    self.assertTrue(fact in compact, f'{path.parts[-4]} resume is missing confirmed fact: {fact}')
                for retired in ('至今', '专业排名前3%', '国家级奖项5项、省市级奖项6项'):
                    self.assertFalse(retired in compact, f'{path.parts[-4]} resume still contains retired fact: {retired}')

    def test_both_apps_deliver_the_same_resume(self):
        self.assertEqual(*(hashlib.sha256(path.read_bytes()).hexdigest() for path in RESUMES))

    def test_proxy_preserves_the_portfolio_cache_policy(self):
        caddyfile = (ROOT / 'docker/Caddyfile').read_text(encoding='utf-8')
        portfolio = caddyfile.split('{$SITE_DOMAIN} {', 1)[1].split('{$API_DOMAIN}', 1)[0]
        # The static server owns separate policies for the home page, versioned
        # assets, PDF and errors. A proxy override breaks those HTTP contracts.
        self.assertNotRegex(portfolio, r'(?mi)^\s*header\s+(?:@\S+\s+)?[+>\-]?Cache-Control\b')


if __name__ == '__main__':
    unittest.main()
