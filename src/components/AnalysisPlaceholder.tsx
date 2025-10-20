import React from 'react';
import { ChartIcon } from './icons';

interface AnalysisPlaceholderProps {
    message: string;
    isError: boolean;
}

export const AnalysisPlaceholder: React.FC<AnalysisPlaceholderProps> = ({ message, isError }) => {
    return (
        <div className="flex flex-col justify-center items-center h-full text-center text-gray-400 py-4 min-h-[250px]">
            <ChartIcon className="h-12 w-12 text-gray-700 mb-3" />
            <p className={`text-sm px-4 ${isError ? 'text-red-400' : 'text-gray-400'}`}>
                {message}
            </p>
        </div>
    );
};
