import React from "react";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function LocationCards({ locations }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
      {locations.map((loc) => (
        <div
          key={loc.city}
          className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs"
        >
          <h4 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" /> {loc.city} Office
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
            {loc.address}
          </p>

          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700/60 space-y-2 text-xs font-semibold">
            <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
              <Phone className="w-3.5 h-3.5 text-gray-400" /> {loc.phone}
            </div>
            <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
              <Mail className="w-3.5 h-3.5 text-gray-400" /> {loc.email}
            </div>
            <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> {loc.hours}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
