import React from 'react';

interface PageHeaderProps {
    title: string;
    children?: React.ReactNode; // For buttons or other actions
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, children }) => {
    return (
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
            <div>{children}</div>
        </div>
    );
};

export default PageHeader;
