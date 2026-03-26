FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/sdk:9.0
WORKDIR /app
COPY --from=build /app .

# Install Aspire workload for compiling AppHost code
RUN dotnet workload install aspire

# Install Node.js for TypeScript support
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g typescript ts-node

RUN useradd -m coderunner
USER coderunner
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "AspireAcademy.CodeRunner.dll"]
