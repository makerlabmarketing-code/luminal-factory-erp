'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  customerShippingMinor, isRaffleShippingRate, parseShippingUsd, type RaffleShippingRate,
} from '@/lib/commerce-admin/raffle-shipping';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (minor: number) => usd.format(minor / 100);

export default function RaffleShippingRateEditor({ raffleId, canManage }: { raffleId: string; canManage: boolean }) {
  const endpoint = `/api/admin/commerce/raffles/${raffleId}/shipping-rates`;
  const [rates, setRates] = useState<RaffleShippingRate[]>([]);
  const [country, setCountry] = useState('');
  const [carrier, setCarrier] = useState('');
  const [covered, setCovered] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const carrierMinor = parseShippingUsd(carrier);
  const coveredMinor = parseShippingUsd(covered);
  const formRate = /^[A-Z]{2}$/.test(country) && carrierMinor !== null && coveredMinor !== null
    ? { country_code: country, carrier_minor: carrierMinor, covered_minor: coveredMinor } : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.rates) || !result.rates.every(isRaffleShippingRate)) {
          throw new Error('Không thể tải bảng phí giao hàng.');
        }
        setRates(result.rates);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Không thể tải bảng phí giao hàng.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRate || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formRate),
      });
      const result = await response.json();
      const rate: unknown = result.rate;
      if (!response.ok || !isRaffleShippingRate(rate)) throw new Error('Không thể lưu mức phí.');
      setRates(previous => [...previous.filter(row => row.country_code !== rate.country_code), rate]
        .sort((a, b) => a.country_code.localeCompare(b.country_code)));
      setSaved(true);
    } catch {
      setError('Không thể lưu mức phí. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="admin-card space-y-4 p-4 sm:p-5" aria-labelledby="raffle-shipping-rates">
    <h2 id="raffle-shipping-rates" className="font-bold">Phí giao hàng</h2>
    <p className="text-sm text-slate-400">Nhập theo USD, cùng tiền tệ với giá OldToy. Khách Việt Nam được miễn phí giao hàng.</p>
    {loading && <p role="status">Đang tải bảng phí…</p>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Đã lưu mức phí.</p>}
    {rates.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th scope="col">Quốc gia</th><th scope="col">Cước hãng</th><th scope="col">Luminal hỗ trợ</th><th scope="col">Khách trả</th></tr></thead>
      <tbody>{rates.map(rate => <tr key={rate.country_code}>
        <td className="py-2">{canManage ? <button type="button" className="underline" disabled={saving} onClick={() => {
          setCountry(rate.country_code);
          setCarrier((rate.carrier_minor / 100).toFixed(2));
          setCovered((rate.covered_minor / 100).toFixed(2));
          setSaved(false);
        }}>{rate.country_code}</button> : rate.country_code}</td>
        <td>{money(rate.carrier_minor)}</td>
        <td>{money(Math.min(rate.carrier_minor, rate.country_code === 'VN' ? rate.carrier_minor : rate.covered_minor))}</td>
        <td>{money(rate.customer_minor)}</td>
      </tr>)}</tbody>
    </table></div>}
    {canManage && <form onSubmit={save}>
      <fieldset disabled={loading || saving} className="grid gap-3 sm:grid-cols-3">
        <label className="admin-label">Mã quốc gia<input className="admin-field mt-2" value={country} placeholder="US" maxLength={2} onChange={event => setCountry(event.target.value.toUpperCase())} /></label>
        <label className="admin-label">Cước hãng (USD)<input className="admin-field mt-2" inputMode="decimal" value={carrier} onChange={event => setCarrier(event.target.value)} /></label>
        <label className="admin-label">Luminal hỗ trợ (USD)<input className="admin-field mt-2" inputMode="decimal" value={covered} onChange={event => setCovered(event.target.value)} /></label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
          <button className="admin-button-primary" disabled={!formRate}>{saving ? 'Đang lưu…' : 'Lưu mức phí'}</button>
          {formRate && <output>Khách trả {money(customerShippingMinor(formRate))}</output>}
        </div>
      </fieldset>
    </form>}
  </section>;
}
