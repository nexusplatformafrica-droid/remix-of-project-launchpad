import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { PHONE_COUNTRIES } from "@/lib/phone-country";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function CountryFlag({ code, name }: { code: string; name: string }) {
  return <img src={`/flags/${code.toLowerCase()}.svg`} alt={`${name} flag`} className="h-4 w-6 shrink-0 rounded-sm object-cover" />;
}

export function CountryPhoneInput({ country, onCountryChange, phone, onPhoneChange, disabled = false }: {
  country: CountryCode; onCountryChange: (code: CountryCode) => void;
  phone: string; onPhoneChange: (phone: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = PHONE_COUNTRIES.find((c) => c.code === country);
  if (!selected) return null;
  // Light theme for this control: the app shell is dark, but the phone
  // country picker must read as a light form field.
  const lightVars = {
    "--background": "#ffffff",
    "--foreground": "#171717",
    "--popover": "#ffffff",
    "--popover-foreground": "#171717",
    "--muted-foreground": "#525252",
    "--accent": "#f0f0f0",
    "--accent-foreground": "#171717",
    "--input": "#d4d4d4",
  } as React.CSSProperties;
  return <div style={lightVars} className="flex h-11 w-full min-w-0 items-center rounded-md border border-input bg-background text-foreground focus-within:ring-2 focus-within:ring-ring">
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" disabled={disabled} role="combobox" aria-expanded={open} aria-label={`Phone country: ${selected.name}`} className="h-full shrink-0 gap-1.5 rounded-r-none border-r border-input px-2">
          <CountryFlag code={selected.code} name={selected.name} /><span className="text-xs">+{selected.dial}</span><ChevronsUpDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" style={lightVars} className="w-[min(320px,calc(100vw-32px))] border-neutral-200 bg-white p-0 text-neutral-900 shadow-xl">
        <Command><CommandInput placeholder="Search country or code…" aria-label="Search country" />
          <CommandList><CommandEmpty>No countries found.</CommandEmpty><CommandGroup>
            {PHONE_COUNTRIES.map((c) => <CommandItem key={c.code} value={`${c.name} ${c.code} +${c.dial}`} onSelect={() => { onCountryChange(c.code); setOpen(false); }}>
              <CountryFlag code={c.code} name={c.name} /><span className="min-w-0 flex-1">{c.name}</span><span className="text-xs text-muted-foreground">+{c.dial}</span>{c.code === country && <Check className="size-4 text-primary" />}
            </CommandItem>)}
          </CommandGroup></CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <input required type="tel" autoComplete="tel-national" aria-label="Phone number" placeholder="Phone number" value={phone} onChange={(e) => onPhoneChange(e.target.value)} disabled={disabled} className="h-full w-full min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground" />
  </div>;
}