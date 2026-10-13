'use client';

import type { ReactNode } from 'react';
import { saveBusinessProfile } from '@/controllers/admin/settings.actions';
import { Card, FormMessage, inputClass, Labeled, SubmitButton } from '../ui';
import { I18nInputs, useForm, type SettingsData } from './shared';

type Feature = { title?: Record<string, string>; text?: Record<string, string> };

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-line grid gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-extrabold">{title}</h3>
        {hint && <p className="text-muted text-sm">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Everything the website says about the restaurant: name, logo letters, address, social
 * links, home page texts and search engine texts. Georgian and Russian fall back to
 * English when left empty.
 */
export function BusinessProfileForm({ data }: { data: SettingsData }) {
  const [state, action, pending] = useForm(saveBusinessProfile);
  const s = data.settings;
  const features = (Array.isArray(s.features) ? s.features : []) as Feature[];
  return (
    <Card
      title="Business profile"
      description="The name, address and texts shown across the website, on bills and in order messages. Empty Georgian or Russian fields use the English text."
    >
      <form action={action} className="grid gap-6">
        <Section title="Name and logo">
          <div className="grid gap-3 sm:grid-cols-3">
            <Labeled label="Restaurant name *" hint="Short, e.g. in the logo and messages">
              <input
                name="brand_name"
                defaultValue={s.brand_name}
                required
                maxLength={60}
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Logo letters *" hint="1–3 letters in the round logo">
              <input
                name="monogram"
                defaultValue={s.monogram}
                required
                maxLength={3}
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Order number prefix *" hint="Orders show as PREFIX-1042">
              <input
                name="order_prefix"
                defaultValue={s.order_prefix}
                required
                maxLength={6}
                pattern="[A-Za-z0-9]{1,6}"
                className={`${inputClass} uppercase`}
              />
            </Labeled>
          </div>
          <I18nInputs
            base="site_name"
            value={s.site_name}
            label="Full name * (page titles, footer, bills)"
            maxLength={80}
          />
          <I18nInputs
            base="tagline"
            value={s.tagline}
            label="Tagline (under the logo, on the home page and the bill)"
            maxLength={80}
          />
          <I18nInputs
            base="specialties"
            value={s.specialties}
            label="What you serve, in one line (menu page header)"
            maxLength={100}
          />
          <Labeled
            label="Cuisines, for Google"
            hint="Comma-separated, in English, e.g. Indian, South Indian"
          >
            <input
              name="cuisines"
              defaultValue={s.cuisines.join(', ')}
              maxLength={300}
              className={inputClass}
            />
          </Labeled>
        </Section>

        <Section
          title="Address and contact"
          hint="The map pin, phone and WhatsApp are under Restaurant details."
        >
          <I18nInputs base="street" value={s.street} label="Street and number" maxLength={120} />
          <I18nInputs base="city" value={s.city} label="City" maxLength={60} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Labeled label="Postcode">
              <input
                name="postal_code"
                defaultValue={s.postal_code}
                maxLength={20}
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Country code *" hint="2 letters, e.g. GE">
              <input
                name="country_code"
                defaultValue={s.country_code}
                required
                maxLength={2}
                className={`${inputClass} uppercase`}
              />
            </Labeled>
            <Labeled label="Time zone *" hint="Order times, reports and tickets use it">
              <input
                name="timezone"
                defaultValue={s.timezone}
                required
                placeholder="Asia/Tbilisi"
                className={inputClass}
              />
            </Labeled>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Email (optional, shown in the footer)">
              <input
                name="email"
                type="email"
                defaultValue={s.email ?? ''}
                maxLength={120}
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Instagram link">
              <input
                name="instagram_url"
                type="url"
                defaultValue={s.instagram_url ?? ''}
                placeholder="https://instagram.com/…"
                className={inputClass}
              />
            </Labeled>
            <Labeled label="Facebook link">
              <input
                name="facebook_url"
                type="url"
                defaultValue={s.facebook_url ?? ''}
                placeholder="https://facebook.com/…"
                className={inputClass}
              />
            </Labeled>
            <Labeled label="TikTok link">
              <input
                name="tiktok_url"
                type="url"
                defaultValue={s.tiktok_url ?? ''}
                placeholder="https://tiktok.com/@…"
                className={inputClass}
              />
            </Labeled>
          </div>
        </Section>

        <Section title="Home page">
          <I18nInputs base="headline" value={s.headline} label="Headline" maxLength={80} />
          <I18nInputs
            base="intro"
            value={s.intro}
            label="Intro under the headline"
            rows={3}
            maxLength={300}
          />
          <I18nInputs
            base="about_title"
            value={s.about_title}
            label="“Our story” title"
            maxLength={100}
          />
          <I18nInputs
            base="about_text"
            value={s.about_text}
            label="“Our story” text"
            rows={6}
            maxLength={1500}
            hint="Leave an empty line between paragraphs."
          />
          <I18nInputs
            base="highlights"
            value={s.highlights}
            label="Words in the scrolling gold band"
            rows={6}
            hint="One per line, up to 12. Leave English empty to hide the band."
          />
          <fieldset className="grid gap-4">
            <legend className="mb-1 text-sm font-bold">“Why us” cards (up to 4)</legend>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-soft grid gap-2 rounded-xl p-3">
                <I18nInputs
                  base={`feature${i}_title`}
                  value={features[i]?.title}
                  label={`Card ${i + 1}: title`}
                  maxLength={40}
                />
                <I18nInputs
                  base={`feature${i}_text`}
                  value={features[i]?.text}
                  label={`Card ${i + 1}: text`}
                  maxLength={100}
                />
              </div>
            ))}
          </fieldset>
        </Section>

        <Section
          title="Google and link previews"
          hint="Empty fields are filled in from the full name, tagline and intro."
        >
          <I18nInputs base="seo_title" value={s.seo_title} label="Home page title" maxLength={90} />
          <I18nInputs
            base="seo_description"
            value={s.seo_description}
            label="Home page description"
            rows={3}
            maxLength={200}
          />
          <I18nInputs
            base="menu_description"
            value={s.menu_description}
            label="Menu page description"
            rows={3}
            maxLength={200}
          />
        </Section>

        <FormMessage state={state} />
        <SubmitButton pending={pending}>Save business profile</SubmitButton>
      </form>
    </Card>
  );
}
